const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema(
  {
    studentName: {
      type: String,
      required: true,
    },
    branch: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    year: {
      type: String,
      required: true,
    },
    feedbackText: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", FeedbackSchema);
