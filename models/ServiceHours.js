const mongoose = require("mongoose");

const serviceHoursSchema = new mongoose.Schema(
  {
    breakfast: {
      start: { type: String, default: "08:00" },
      end: { type: String, default: "11:00" },
    },
    lunch: {
      start: { type: String, default: "12:00" },
      end: { type: String, default: "15:00" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceHours", serviceHoursSchema);
