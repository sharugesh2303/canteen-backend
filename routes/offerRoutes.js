const express = require("express");
const mongoose = require("mongoose");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();
const Offer = mongoose.model("Offer");

/* ================= CREATE OFFER ================= */
router.post("/", adminAuth, async (req, res) => {
  try {
    const offer = await Offer.create(req.body);
    res.status(201).json(offer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ================= GET ALL OFFERS ================= */
router.get("/", adminAuth, async (req, res) => {
  try {
    const offers = await Offer.find()
      .populate("applicableItems", "name price imageUrl")
      .sort({ createdAt: -1 });

    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch offers" });
  }
});

/* ================= UPDATE OFFER ================= */
router.put("/:id", adminAuth, async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(offer);
  } catch (err) {
    res.status(400).json({ message: "Failed to update offer" });
  }
});

/* ================= DELETE OFFER ================= */
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    res.json({ message: "Offer deleted" });
  } catch (err) {
    res.status(400).json({ message: "Failed to delete offer" });
  }
});

/* ✅ THIS LINE IS CRITICAL */
module.exports = router;
