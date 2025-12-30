const jwt = require("jsonwebtoken");
require("dotenv").config();

module.exports = function adminAuth(req, res, next) {
  const authHeader = req.header("Authorization");

  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      message: "No token provided, authorization denied",
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Server error: JWT_SECRET not configured",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Attach decoded admin info to request
    req.admin = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};
