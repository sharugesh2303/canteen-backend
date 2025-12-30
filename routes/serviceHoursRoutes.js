const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const ServiceHours = require("../models/ServiceHours");

const router = express.Router();

/* =====================================================
   🔁 ENSURE SINGLE DOCUMENT
===================================================== */
async function getOrCreateServiceHours() {
  let hours = await ServiceHours.findOne();

  if (!hours) {
    hours = await ServiceHours.create({
      breakfast: { start: "08:00", end: "11:00" },
      lunch: { start: "12:00", end: "15:00" },
    });
  }

  return hours;
}

/* =====================================================
   🌍 GET SERVICE HOURS (PUBLIC + ADMIN)
   GET /api/service-hours/public
===================================================== */
router.get("/service-hours/public", async (req, res) => {
  try {
    const hours = await getOrCreateServiceHours();
    res.json(hours);
  } catch (err) {
    console.error("❌ FETCH SERVICE HOURS ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch service hours" });
  }
});

/* =====================================================
   🔐 UPDATE SERVICE HOURS (ADMIN)
   PATCH /api/admin/service-hours
===================================================== */
router.patch("/admin/service-hours", adminAuth, async (req, res) => {
  try {
    const hours = await getOrCreateServiceHours();

    const {
      breakfastStart,
      breakfastEnd,
      lunchStart,
      lunchEnd,
    } = req.body;

    // ✅ UPDATE BREAKFAST ONLY IF SENT
    if (breakfastStart && breakfastEnd) {
      hours.breakfast.start = breakfastStart;
      hours.breakfast.end = breakfastEnd;
    }

    // ✅ UPDATE LUNCH ONLY IF SENT
    if (lunchStart && lunchEnd) {
      hours.lunch.start = lunchStart;
      hours.lunch.end = lunchEnd;
    }

    await hours.save();
    res.json(hours);
  } catch (err) {
    console.error("❌ UPDATE SERVICE HOURS ERROR:", err);
    res.status(500).json({ msg: "Failed to update service hours" });
  }
});

module.exports = router;
