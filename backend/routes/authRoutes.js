const express = require("express");

const {
  register,
  login,
  getCurrentUser,
  updateProfilePicture,
  updateProfilePhone,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

router.get("/me", protect, getCurrentUser);

router.patch("/profile-picture", protect, updateProfilePicture);

router.patch("/profile-phone", protect, updateProfilePhone);

router.get("/test", (req, res) => {
  res.json({
    message: "Auth route is working",
  });
});

module.exports = router;