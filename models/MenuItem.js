const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema(
  {
    /* ================= BASIC INFO ================= */
    name: {
      type: String,
      required: true,
      trim: true
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    category: {
      type: String,
      required: true,
      trim: true
    },

    /* ================= SUB CATEGORY =================
       IMPORTANT FIX:
       - Model name MUST match SubCategory.js
       - Use "SubCategory" (case-sensitive)
    ================================================= */
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory", // ✅ FIXED (was wrong earlier)
      default: null
    },

    /* ================= IMAGE ================= */
    imageUrl: {
      type: String,
      required: true,
      trim: true
    },

    /* ================= STOCK ================= */
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true // ✅ replaces uploadedAt
  }
);

/* ================= EXPORT =================
   IMPORTANT FIX:
   - Model name must be "MenuItem"
   - Used everywhere: mongoose.model("MenuItem")
================================================= */
module.exports = mongoose.model("MenuItem", MenuItemSchema);
