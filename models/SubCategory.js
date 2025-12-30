const mongoose = require("mongoose");

/* ================= SUB CATEGORY SCHEMA ================= */
const SubCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
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
