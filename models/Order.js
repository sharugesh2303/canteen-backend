const mongoose = require("mongoose");

/* ---------------- ORDER ITEM ---------------- */
const OrderItemSchema = new mongoose.Schema(
  {
    // ✅ menu item id (optional but helpful)
    itemId: { type: String },

    // ✅ item name
    name: { type: String, required: true },

    // ✅ quantity
    quantity: { type: Number, required: true, min: 1 },

    // ✅ FINAL unit price (after offer) - actual pay price
    unitPrice: { type: Number, required: true },

    // ✅ Original price (MRP/before discount) - for strike display
    originalPrice: { type: Number, default: 0 },

    // ✅ offer percentage used
    offerPercent: { type: Number, default: 0 },
  },
  { _id: false }
);

/* ---------------- ORDER ---------------- */
const OrderSchema = new mongoose.Schema(
  {
    /* Items */
    items: { type: [OrderItemSchema], default: [] },

    /* Amount */
    totalAmount: {
      type: Number,
      required: true,
    },

    /* Pickup */
    collectionTime: {
      type: String,
      required: true,
    },

    /* Payment */
    paymentMethod: {
      type: String,
      enum: ["RAZORPAY"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["PAID", "FAILED", "PENDING"],
      default: "PENDING",
    },

    paymentId: String,

    /* ✅ ORDER STATUS (Kitchen Progress) */
    orderStatus: {
      type: String,
      enum: ["PLACED", "PREPARING", "READY", "COLLECTED"],
      default: "PLACED",
    },

    /* 🔐 DEVICE IDENTIFIER (NO LOGIN) */
    deviceId: {
      type: String,
      required: true,
      index: true,
    },

    /* Bill & QR */
    billNumber: {
      type: String,
      unique: true,
    },

    qrNumber: {
      type: String,
      unique: true,
    },

    qrImage: String,
    qrVisibleAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
