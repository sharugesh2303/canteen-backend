/* ======================================================
 * FILE: models/Feedback.js
 * ====================================================== */

const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema(
  {
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    branch: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: String,
      required: true,
    },
    feedbackText: {
      type: String,
      required: true,
      trim: true,
    },
    // 📍 LOCATION FIELD: Splits feedback between Canteen and Cafeteria
    location: {
      type: String,
      enum: ["canteen", "cafeteria"],
      required: true,
      lowercase: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { 
    timestamps: true // Automatically creates createdAt and updatedAt fields
  }
);

/* ======================================================
    INDEXING
    Optimizes performance when the Admin Panel filters
    feedback by location.
====================================================== */
FeedbackSchema.index({ location: 1, createdAt: -1 });

module.exports = mongoose.model("Feedback", FeedbackSchema);