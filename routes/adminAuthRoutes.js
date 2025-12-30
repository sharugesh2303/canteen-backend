const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const router = express.Router();

/*
======================================================
 ADMIN LOGIN
 Route: POST /api/admin/login
------------------------------------------------------
 - Verifies admin credentials
 - Returns JWT token
======================================================
*/
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    /* ================= VALIDATION ================= */
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    /* ================= FIND ADMIN =================
       IMPORTANT:
       - password field must be selected explicitly
    ================================================= */
    const admin = await Admin.findOne({ email }).select("+password");

    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    /* ================= PASSWORD CHECK ================= */
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    /* ================= JWT CONFIG CHECK ================= */
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET missing in .env");
      return res.status(500).json({
        message: "Server configuration error",
      });
    }

    /* ================= GENERATE TOKEN ================= */
    const token = jwt.sign(
      {
        id: admin._id,
        role: admin.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    /* ================= SUCCESS RESPONSE ================= */
    return res.status(200).json({
      success: true,
      token,
    });

  } catch (error) {
    console.error("❌ Admin login error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

module.exports = router;
