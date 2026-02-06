const mongoose = require("mongoose");

/* ---------------- ORDER ITEM ---------------- */
const OrderItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },

    // Final paid price
    unitPrice: { type: Number, default: 0, min: 0 },

    // MRP
    originalPrice: { type: Number, default: 0, min: 0 },

    // Discount used
    offerPercent: { type: Number, default: 0, min: 0 },

    /* Delivery tracking per item */
    delivered: { type: Boolean, default: false },
    deliveredAt: { type: Date, default: null },
  },
  { _id: false }
);

/* ---------------- ORDER ---------------- */
const OrderSchema = new mongoose.Schema(
  {
    /* =====================================================
       🏪 NEW: ORDER LOCATION (CANTEEN / CAFETERIA)
       Required for Admin split view
    ===================================================== */
    location: {
      type: String,
      enum: ["canteen", "cafeteria"],
      required: true,
      default: "canteen",
      index: true,
    },

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

    /* Kitchen Status */
    orderStatus: {
      type: String,
      enum: ["PLACED", "PREPARING", "READY", "COLLECTED", "DELIVERED"],
      default: "PLACED",
      index: true,
    },

    /* Bill Delivered Time */
    deliveredAt: { type: Date, default: null },

    /* Device (student identifier) */
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
