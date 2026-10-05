const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
  createUser,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  updateUserById,
} = require("../models/userModel");

async function register(req, res) {
  try {
    const {
      name,
      email,
      phone,
      password,
      confirmPassword,
    } = req.body;

    if (!name || !phone || !password || !confirmPassword) {
      return res.status(400).json({
        message: "Name, phone number, and password are required.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters.",
      });
    }

    const cleanName = name.trim();
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    const cleanEmail = email?.trim().toLowerCase() || "";

    if (!/^\+?\d{7,15}$/.test(cleanPhone)) {
      return res.status(400).json({
        message: "Enter a valid phone number with country code.",
      });
    }

    const existingUser = await findUserByPhone(cleanPhone);

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this phone number already exists.",
      });
    }

    if (cleanEmail && await findUserByEmail(cleanEmail)) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    const user = {
      name: cleanName,
      ...(cleanEmail ? { email: cleanEmail } : {}),
      phone: cleanPhone,
      password: hashedPassword,
      createdAt: new Date(),
    };

    const result = await createUser(user);

    const token = jwt.sign(
      {
        userId: result.insertedId.toString(),
        phone: cleanPhone,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      message: "Account created successfully.",
      token,
      user: {
        id: result.insertedId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "That phone number or email is already registered.",
      });
    }

    res.status(500).json({
      message: "Something went wrong while creating your account.",
    });
  }
}

async function login(req, res) {
  try {
    const { identifier, email, phone, password } = req.body;
    const loginIdentifier = (identifier || phone || email || "").trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        message: "Phone number or email and password are required.",
      });
    }

    const cleanEmail = loginIdentifier.toLowerCase();
    const cleanPhone = loginIdentifier.replace(/[^\d+]/g, "");
    const user = loginIdentifier.includes("@")
      ? await findUserByEmail(cleanEmail)
      : await findUserByPhone(cleanPhone);

    if (!user) {
      return res.status(401).json({
        message: "Invalid phone/email or password.",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid phone/email or password.",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        phone: user.phone,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Something went wrong while logging in.",
    });
  }
}

async function getCurrentUser(req, res) {
  try {
    const user = await findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);

    res.status(500).json({
      message: "Unable to get user information.",
    });
  }
}

async function updateProfilePicture(req, res) {
  try {
    const { profilePicture } = req.body;
    const allowedImage = /^data:image\/(png|jpeg|webp);base64,/;

    if (
      typeof profilePicture !== "string" ||
      !allowedImage.test(profilePicture) ||
      profilePicture.length > 1024 * 1024
    ) {
      return res.status(400).json({
        message: "Choose a PNG, JPEG, or WebP image smaller than 700 KB.",
      });
    }

    await updateUserById(req.user.userId, { profilePicture });
    const user = await findUserById(req.user.userId);

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email || "",
        phone: user.phone,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Update profile picture error:", error);
    res.status(500).json({
      message: "Unable to update profile picture.",
    });
  }
}

async function updateProfilePhone(req, res) {
  try {
    const cleanPhone = String(req.body.phone || "").replace(/[^\d+]/g, "");

    if (!/^\+?\d{7,15}$/.test(cleanPhone)) {
      return res.status(400).json({
        message: "Enter a valid phone number with country code.",
      });
    }

    const existingUser = await findUserByPhone(cleanPhone);

    if (existingUser && existingUser._id.toString() !== req.user.userId) {
      return res.status(409).json({
        message: "That phone number is already registered.",
      });
    }

    await updateUserById(req.user.userId, { phone: cleanPhone });
    const user = await findUserById(req.user.userId);

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email || "",
        phone: user.phone,
        profilePicture: user.profilePicture || "",
      },
    });
  } catch (error) {
    console.error("Update profile phone error:", error);
    res.status(500).json({
      message: "Unable to update registered phone number.",
    });
  }
}

module.exports = {
  register,
  login,
  getCurrentUser,
  updateProfilePicture,
  updateProfilePhone,
};