const express = require("express");
const router = express.Router();
const NotificationToken = require("../models/NotificationToken");
const { hashDeviceId } = require("../utils/hash");

// ✅ Register or update device FCM token
// Endpoint: POST /api/notifications/register
router.post("/register", async (req, res) => {
  try {
    const { deviceId, fcmToken } = req.body;

    if (!deviceId || !fcmToken) {
      return res.status(400).json({
        message: "deviceId and fcmToken required",
      });
    }

    // ✅ important: store hashed deviceId (same as Orders)
    const hashedDeviceId =
      deviceId.length === 64 ? deviceId : hashDeviceId(deviceId);

    await NotificationToken.findOneAndUpdate(
      { deviceId: hashedDeviceId },
      { fcmToken },
      { upsert: true, new: true }
    );

    res.json({
      message: "✅ FCM token registered successfully",
      deviceId: hashedDeviceId,
    });
  } catch (err) {
    console.error("❌ FCM register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
