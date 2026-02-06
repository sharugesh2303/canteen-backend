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
const expireOffers = async (location) => {
  const now = new Date();

  // Filter by location during expiration check to be precise
  const query = { isActive: true };
  if (location) query.location = location;

  const activeOffers = await Offer.find(query);

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

/* ================= CREATE OFFER ================= 
   Tagging the offer with the correct location
================================================== */
router.post("/", adminAuth, async (req, res) => {
  try {
    // Ensure location is saved from the form
    const offerData = {
      ...req.body,
      location: req.body.location || "canteen"
    };
    const offer = await Offer.create(offerData);
    res.status(201).json(offer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ================= GET ALL OFFERS (ADMIN) ================= 
   🟢 PERSISTENCE FIX: Filter by mode (canteen/cafeteria)
=========================================================== */
router.get("/", adminAuth, async (req, res) => {
  try {
    const { mode } = req.query; // Get mode from frontend request
    
    await expireOffers(mode);

    let query = {};
    if (mode === "cafeteria") {
      query.location = "cafeteria";
    } else {
      // Default to canteen or items with no location field
      query = { $or: [{ location: "canteen" }, { location: { $exists: false } }] };
    }

    const offers = await Offer.find(query)
      .populate("applicableItems", "name price imageUrl category")
      .sort({ createdAt: -1 });

    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch offers" });
  }
});

/* ================= GET ACTIVE OFFERS (PUBLIC / STUDENT) =================
    🟢 PERSISTENCE FIX: Filter by location query param
========================================================================= */
router.get("/public", async (req, res) => {
  try {
    const { location } = req.query;
    await expireOffers(location);

    const now = new Date();

    let query = { isActive: true };
    if (location === "cafeteria") {
      query.location = "cafeteria";
    } else {
      query = { $or: [{ location: "canteen" }, { location: { $exists: false } }] };
    }

    const offers = await Offer.find(query)
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