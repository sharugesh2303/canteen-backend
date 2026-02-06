const mongoose = require("mongoose");

/* ================= SUB CATEGORY SCHEMA ================= */
const SubCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
      // 🟢 REMOVED unique: true to allow same subcategory name in different locations
    },

    /* 🟢 NEW: Location field to separate Canteen and Cafeteria */
    location: {
      type: String,
      required: true,
      enum: ["canteen", "cafeteria"],
      default: "canteen" // 🟢 Ensures existing subcategories default to canteen
    },

    imageUrl: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

/* ================= EXPORT =================
   IMPORTANT:
   Model name MUST be "SubCategory"
   This MUST match:
   - ref: "SubCategory"
   - mongoose.model("SubCategory")
================================================= */
module.exports = mongoose.model("SubCategory", SubCategorySchema);