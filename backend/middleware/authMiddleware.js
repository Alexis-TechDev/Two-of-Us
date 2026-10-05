const jwt = require("jsonwebtoken");

function protect(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const parts = authorization.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        message: "Invalid authorization format.",
      });
    }

    const token = parts[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

module.exports = protect;