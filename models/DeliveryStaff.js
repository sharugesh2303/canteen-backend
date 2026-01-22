const mongoose = require("mongoose");

const DeliveryStaffSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// ✅ prevent model overwrite error in nodemon/hot-reload
module.exports =
  mongoose.models.DeliveryStaff ||
  mongoose.model("DeliveryStaff", DeliveryStaffSchema);
