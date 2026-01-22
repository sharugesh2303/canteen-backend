const jwt = require("jsonwebtoken");

/**
 * ✅ STAFF AUTH MIDDLEWARE
 * - Used for Chef/Delivery/Staff APIs
 * - Reads token from Authorization header
 * - Verifies JWT using JWT_SECRET
 */
module.exports = function staffAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // ✅ No token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded should contain staff info
    req.staff = decoded;

    // ✅ optional role check
    const allowedRoles = ["chef", "delivery", "staff", "admin"];
    if (decoded.role && !allowedRoles.includes(decoded.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  } catch (err) {
    console.error("❌ Staff JWT verification failed:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
