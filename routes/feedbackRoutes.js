const express = require("express");
const mongoose = require("mongoose");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();
const Feedback = mongoose.model("Feedback");

/* ======================================================
   STUDENT – SUBMIT FEEDBACK
   POST /api/feedback
====================================================== */
router.post("/", async (req, res) => {
  try {
    const feedback = new Feedback(req.body);
    await feedback.save();
    res.json({ success: true });
  } catch (err) {
    console.error("❌ FEEDBACK SUBMIT ERROR:", err);
    res.status(500).json({ msg: "Failed to submit feedback" });
  }
});

/* ======================================================
   ADMIN – GET ALL FEEDBACK
   GET /api/admin/feedback
====================================================== */
router.get("/", adminAuth, async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    console.error("❌ FETCH FEEDBACK ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch feedback" });
  }
});

/* ======================================================
   ADMIN – MARK SINGLE FEEDBACK AS READ
   PATCH /api/admin/feedback/:id/read
====================================================== */
router.patch("/:id/read", adminAuth, async (req, res) => {
  try {
    await Feedback.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ MARK READ ERROR:", err);
    res.status(500).json({ msg: "Failed to update feedback" });
  }
});

/* ======================================================
   ADMIN – MARK ALL AS READ
   POST /api/admin/feedback/mark-all-read
====================================================== */
router.post("/mark-all-read", adminAuth, async (req, res) => {
  try {
    await Feedback.updateMany({ isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ MARK ALL READ ERROR:", err);
    res.status(500).json({ msg: "Failed to update feedbacks" });
  }
});

/* ======================================================
   ✅ ADMIN – DELETE ALL FEEDBACK (FIXED POSITION)
   DELETE /api/admin/feedback/delete-all
====================================================== */
router.delete("/delete-all", adminAuth, async (req, res) => {
  try {
    await Feedback.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE ALL FEEDBACK ERROR:", err);
    res.status(500).json({ msg: "Failed to delete all feedback" });
  }
});

/* ======================================================
   ADMIN – DELETE SINGLE FEEDBACK
   DELETE /api/admin/feedback/:id
====================================================== */
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE FEEDBACK ERROR:", err);
    res.status(500).json({ msg: "Failed to delete feedback" });
  }
});

module.exports = router;
