const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// ✅ REGISTER STAFF (Chef)
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "name, email, password are required",
      });
    }

    const DeliveryStaff = mongoose.model("DeliveryStaff");

    const exists = await DeliveryStaff.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Staff already exists" });
    }

    // ✅ Auto username from email
    const username = email.split("@")[0];

    const staff = await DeliveryStaff.create({
      name,
      username,
      email,
      password, // ⚠️ plain for now
      role: role || "chef",
    });

    res.status(201).json({
      message: "✅ Staff created successfully",
      staff,
    });
  } catch (err) {
    console.error("❌ STAFF REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ LOGIN STAFF (Chef)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "email and password are required",
      });
    }

    // ✅ Important Safety Check
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET missing in .env file",
      });
    }

    const DeliveryStaff = mongoose.model("DeliveryStaff");

    const staff = await DeliveryStaff.findOne({ email });
    if (!staff) {
      return res.status(400).json({ message: "Staff not found" });
    }

    // ✅ Plain password check (for now)
    if (staff.password !== password) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // ✅ Create REAL JWT token
    const token = jwt.sign(
      {
        staffId: staff._id,
        email: staff.email,
        role: staff.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "✅ Login success",
      staff: {
        _id: staff._id,
        name: staff.name,
        username: staff.username,
        email: staff.email,
        role: staff.role,
      },
      token,
    });
  } catch (err) {
    console.error("❌ STAFF LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
