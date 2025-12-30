const QRCode = require("qrcode");

/**
 * Generates a QR code image (Base64 PNG) from a bill URL
 * @param {string} url - URL to open bill page
 * @returns {Promise<string>} Base64 QR image
 */
exports.generateQrImage = async (url) => {
  try {
    // IMPORTANT:
    // QRCode expects a STRING (URL), NOT an object or JSON
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      type: "image/png",
      margin: 2,
      width: 300
    });
  } catch (err) {
    console.error("❌ QR generation failed:", err);
    throw new Error("QR generation failed");
  }
};
