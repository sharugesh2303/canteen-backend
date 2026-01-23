const mongoose = require("mongoose");

const NotificationTokenSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    fcmToken: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NotificationToken", NotificationTokenSchema);
