const express = require("express");
const mongoose = require("mongoose");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();
const Offer = mongoose.model("Offer");

/* ======================================================
   ✅ Helper: combine date + time into Date object
====================================================== */
function combineDateAndTime(date, time) {
  const [hours, minutes] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

/* ======================================================
   ✅ AUTO-EXPIRE OFFERS (LOCAL TIME SAFE)
====================================================== */
const expireOffers = async () => {
  const now = new Date();

  const activeOffers = await Offer.find({ isActive: true });

  const expiredIds = activeOffers
    .filter((offer) => {
      const endDateTime = combineDateAndTime(offer.endDate, offer.endTime);
      return now > endDateTime;
    })
    .map((offer) => offer._id);

  if (expiredIds.length > 0) {
    await Offer.updateMany(
      { _id: { $in: expiredIds } },
      { $set: { isActive: false } }
    );
  }
};

/* ================= CREATE OFFER ================= */
router.post("/", adminAuth, async (req, res) => {
  try {
    const offer = await Offer.create(req.body);
    res.status(201).json(offer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ================= GET ALL OFFERS (ADMIN) ================= */
router.get("/", adminAuth, async (req, res) => {
  try {
    await expireOffers();

    const offers = await Offer.find()
      .populate("applicableItems", "name price imageUrl category")
      .sort({ createdAt: -1 });

    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch offers" });
  }
});

/* ================= GET ACTIVE OFFERS (PUBLIC / STUDENT) =================
   ✅ FIXED: JS-side datetime check (no UTC issues)
   Endpoint: GET /api/offers/public
========================================================================= */
router.get("/public", async (req, res) => {
  try {
    await expireOffers();

    const now = new Date();

    const offers = await Offer.find({ isActive: true })
      .populate("applicableItems", "name price imageUrl category")
      .sort({ createdAt: -1 });

    const activeOffers = offers.filter((offer) => {
      const startDateTime = combineDateAndTime(offer.startDate, offer.startTime);
      const endDateTime = combineDateAndTime(offer.endDate, offer.endTime);

      return now >= startDateTime && now <= endDateTime;
    });

    res.json(activeOffers);
  } catch (err) {
    console.error("Error fetching public offers:", err);
    res.status(500).json({ message: "Failed to fetch active offers" });
  }
});

/* ================= UPDATE OFFER ================= */
router.put("/:id", adminAuth, async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
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

module.exports = router;
