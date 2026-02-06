/* ======================================================
 * FILE: routes/feedbackRoutes.js
 * ====================================================== */

const express = require("express");
const mongoose = require("mongoose");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();
const Feedback = mongoose.model("Feedback");

/* ======================================================
    1. STUDENT – SUBMIT FEEDBACK
    POST /api/feedback
    Requires: studentName, branch, department, year, 
              feedbackText, location ("canteen"/"cafeteria")
====================================================== */
router.post("/", async (req, res) => {
  try {
    const { studentName, branch, department, year, feedbackText, location } = req.body;

    // Basic validation for location
    if (!location || !['canteen', 'cafeteria'].includes(location.toLowerCase())) {
      return res.status(400).json({ msg: "Valid location (canteen/cafeteria) is required" });
    }

    const feedback = new Feedback({
      studentName,
      branch,
      department,
      year,
      feedbackText,
      location: location.toLowerCase(),
      isRead: false
    });

    await feedback.save();
    res.json({ success: true });
  } catch (err) {
    console.error("❌ FEEDBACK SUBMIT ERROR:", err);
    res.status(500).json({ msg: "Failed to submit feedback" });
  }
});

/* ======================================================
    2. ADMIN – GET ALL FEEDBACK
    GET /api/admin/feedback?location=canteen
    (Supports filtering by location via query)
====================================================== */
router.get("/", adminAuth, async (req, res) => {
  try {
    const { location } = req.query;
    
    let query = {};
    if (location && location !== "all") {
      query.location = location.toLowerCase();
    }

    const feedbacks = await Feedback.find(query).sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    console.error("❌ FETCH FEEDBACK ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch feedback" });
  }
});

/* ======================================================
    3. ADMIN – MARK SINGLE FEEDBACK AS READ
    PATCH /api/admin/feedback/:id/read
========================================================= */
router.patch("/:id/read", adminAuth, async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id, 
      { isRead: true },
      { new: true }
    );
    
    if (!feedback) return res.status(404).json({ msg: "Feedback not found" });
    
    res.json({ success: true, feedback });
  } catch (err) {
    console.error("❌ MARK READ ERROR:", err);
    res.status(500).json({ msg: "Failed to update feedback" });
  }
});

/* ======================================================
    4. ADMIN – MARK ALL AS READ (FOR SPECIFIC LOCATION)
    POST /api/admin/feedback/mark-all-read
========================================================= */
router.post("/mark-all-read", adminAuth, async (req, res) => {
  try {
    const { location } = req.body;
    
    let query = { isRead: false };
    if (location && location !== "all") {
      query.location = location.toLowerCase();
    }

    await Feedback.updateMany(query, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ MARK ALL READ ERROR:", err);
    res.status(500).json({ msg: "Failed to update feedbacks" });
  }
});

/* ======================================================
    5. ADMIN – DELETE ALL FEEDBACK (FOR SPECIFIC LOCATION)
    DELETE /api/admin/feedback/delete-all
========================================================= */
router.delete("/delete-all", adminAuth, async (req, res) => {
  try {
    const { location } = req.query;
    
    let query = {};
    if (location && location !== "all") {
      query.location = location.toLowerCase();
    }

    await Feedback.deleteMany(query);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE ALL FEEDBACK ERROR:", err);
    res.status(500).json({ msg: "Failed to delete feedback" });
  }
});

/* ======================================================
    6. ADMIN – DELETE SINGLE FEEDBACK
    DELETE /api/admin/feedback/:id
========================================================= */
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const result = await Feedback.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ msg: "Feedback not found" });
    
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE FEEDBACK ERROR:", err);
    res.status(500).json({ msg: "Failed to delete feedback" });
  }
});

module.exports = router;