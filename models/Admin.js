const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false // 🔴 IMPORTANT: must be explicitly selected on login
    },
    role: {
      type: String,
      default: "admin",
      enum: ["admin"]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);
