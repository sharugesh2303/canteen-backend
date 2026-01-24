const mongoose = require("mongoose");

/* ---------------- ORDER ITEM ---------------- */
const OrderItemSchema = new mongoose.Schema(
  {
    // ✅ menu item id (optional but helpful)
    itemId: { type: String, default: null },

    // ✅ item name
    name: { type: String, required: true, trim: true },

    // ✅ quantity
    quantity: { type: Number, required: true, min: 1 },

    // ✅ FINAL unit price (after offer) - actual pay price
    // 🔥 FIX: Old orders may not have unitPrice, so default needed
    unitPrice: { type: Number, default: 0, min: 0 },

    // ✅ Original price (MRP/before discount) - for strike display
    originalPrice: { type: Number, default: 0, min: 0 },

    // ✅ offer percentage used
    offerPercent: { type: Number, default: 0, min: 0 },

    /* ===================================================
        ✅ DELIVERY TRACKING (IMPORTANT FOR CHEF PANEL)
        Once item delivered => lock it
    =================================================== */
    delivered: { type: Boolean, default: false },
    deliveredAt: { type: Date, default: null },
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
      min: 0,
    },

    /* Pickup */
    collectionTime: {
      type: String,
      required: true,
      trim: true,
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

    paymentId: { type: String, default: null },

    /* ✅ ORDER STATUS (Kitchen Progress + Delivery) */
    orderStatus: {
      type: String,
      enum: ["PLACED", "PREPARING", "READY", "COLLECTED", "DELIVERED"],
      default: "PLACED",
      index: true,
    },

    /* ✅ Delivered bill tracking (whole bill) */
    deliveredAt: { type: Date, default: null },

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
      index: true,
    },

    qrNumber: {
      type: String,
      unique: true,
      index: true,
    },

    qrImage: { type: String, default: null },
    qrVisibleAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
