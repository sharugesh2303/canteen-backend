const crypto = require("crypto");

function hashDeviceId(deviceId) {
  return crypto
    .createHash("sha256")
    .update(deviceId)
    .digest("hex");
}

module.exports = { hashDeviceId };
