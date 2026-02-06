const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema(
  {
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
    location: {
      type: String,
      required: true,
      enum: ["canteen", "cafeteria"],
      default: "canteen"
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      default: null
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true 
  }
);

module.exports = mongoose.model("MenuItem", MenuItemSchema);