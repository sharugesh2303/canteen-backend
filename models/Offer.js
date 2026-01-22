const mongoose = require("mongoose");

/* ======================================================
   HELPER: Convert Date + HH:mm → Full DateTime
====================================================== */
function combineDateAndTime(date, time) {
  const [hours, minutes] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

const offerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String, // HH:mm
      required: true,
    },

    endTime: {
      type: String, // HH:mm
      required: true,
    },

    applicableCategories: [
      {
        type: String,
      },
    ],

    applicableItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/* ======================================================
   🔁 AUTO-EXPIRE LOGIC (MODEL LEVEL)
====================================================== */

// Virtual field: is currently valid
offerSchema.virtual("isCurrentlyValid").get(function () {
  const now = new Date();

  const startDateTime = combineDateAndTime(
    this.startDate,
    this.startTime
  );

  const endDateTime = combineDateAndTime(
    this.endDate,
    this.endTime
  );

  return now >= startDateTime && now <= endDateTime;
});

// Middleware: auto-disable expired offers on find
offerSchema.pre(/^find/, async function (next) {
  const now = new Date();

  await this.model.updateMany(
    {
      isActive: true,
      $expr: {
        $lt: [
          {
            $dateFromString: {
              dateString: {
                $concat: [
                  { $dateToString: { format: "%Y-%m-%d", date: "$endDate" } },
                  "T",
                  "$endTime",
                  ":00.000Z",
                ],
              },
            },
          },
          now,
        ],
      },
    },
    { $set: { isActive: false } }
  );

  next();
});

module.exports = mongoose.model("Offer", offerSchema);
