const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const ServiceHours = require("../models/ServiceHours");

const router = express.Router();

/* =====================================================
    🔁 HELPER: GET OR CREATE BY LOCATION (WITH CLEANUP)
===================================================== */
async function getOrCreateServiceHours(location) {
    // 1️⃣ Strict search using location
    let hours = await ServiceHours.findOne({ location: location });

    // 2️⃣ Handle legacy data: If multiple records exist, use the one with location
    if (!hours) {
        // Double check if a record without location exists and fix it
        const legacyRecord = await ServiceHours.findOne({ location: { $exists: false } });
        if (legacyRecord) {
            legacyRecord.location = location;
            await legacyRecord.save();
            return legacyRecord;
        }

        // Create new record if absolutely nothing found
        hours = await ServiceHours.create({
            location: location,
            breakfast: { start: "08:00", end: "11:00" },
            lunch: { start: "12:00", end: "15:00" },
        });
    }

    return hours;
}

/* =====================================================
    🌍 GET SERVICE HOURS (PUBLIC + ADMIN)
===================================================== */
router.get("/service-hours/public", async (req, res) => {
    try {
        const { location } = req.query; 
        if (!location) return res.status(400).json({ msg: "Location is required" });

        const hours = await getOrCreateServiceHours(location);
        res.json(hours);
    } catch (err) {
        console.error("❌ FETCH SERVICE HOURS ERROR:", err);
        res.status(500).json({ msg: "Failed to fetch service hours" });
    }
});

/* =====================================================
    🔐 UPDATE SERVICE HOURS (ADMIN)
===================================================== */
router.patch("/admin/service-hours", adminAuth, async (req, res) => {
    try {
        const {
            location, 
            breakfastStart,
            breakfastEnd,
            lunchStart,
            lunchEnd,
        } = req.body;

        if (!location) return res.status(400).json({ msg: "Location is required" });

        const hours = await getOrCreateServiceHours(location);

        // ✅ UPDATE BREAKFAST
        if (breakfastStart !== undefined && breakfastEnd !== undefined) {
            hours.breakfast.start = breakfastStart;
            hours.breakfast.end = breakfastEnd;
        }

        // ✅ UPDATE LUNCH
        if (lunchStart !== undefined && lunchEnd !== undefined) {
            hours.lunch.start = lunchStart;
            hours.lunch.end = lunchEnd;
        }

        // Force mark as modified to ensure Mongoose saves nested objects
        hours.markModified('breakfast');
        hours.markModified('lunch');

        await hours.save();
        console.log(`✅ [Backend] ${location.toUpperCase()} hours updated:`, hours);
        res.json(hours);
    } catch (err) {
        console.error("❌ UPDATE SERVICE HOURS ERROR:", err);
        res.status(500).json({ msg: "Failed to update service hours" });
    }
});

module.exports = router;