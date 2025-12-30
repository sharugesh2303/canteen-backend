const mongoose = require("mongoose");

/* ---------------- ORDER ITEM ---------------- */
const OrderItemSchema = new mongoose.Schema(
  {
    name: String,
    price: Number,
    quantity: Number
  },
  { _id: false }
);

/* ---------------- ORDER ---------------- */
const OrderSchema = new mongoose.Schema(
  {
    /* Items */
    items: [OrderItemSchema],

    /* Amount */
    totalAmount: {
      type: Number,
      required: true
    },

    /* Pickup */
    collectionTime: {
      type: String,
      required: true
    },

    /* Payment */
    paymentMethod: {
      type: String,
      enum: ["RAZORPAY"],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ["PAID", "FAILED", "PENDING"],
      default: "PENDING"
    },
    paymentId: String,

    /* 🔐 DEVICE IDENTIFIER (NO LOGIN) */
    deviceId: {
      type: String,
      required: true,
      index: true
    },

    /* Bill & QR */
    billNumber: {
      type: String,
      unique: true
    },
    qrNumber: {
      type: String,
      unique: true
    },
    qrImage: String,
    qrVisibleAt: Date,

    /* Timestamps */
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
