const express = require("express");
const mongoose = require("mongoose");
const adminAuth = require("../middleware/adminAuth");
const upload = require("../middleware/upload");

const router = express.Router();

/* ================= GET ALL ADS (ADMIN) =================
   GET /advertisements
   (Used by Admin Panel)
======================================================= */
router.get("/", adminAuth, async (req, res) => {
  try {
    const Advertisement = mongoose.model("Advertisement");
    const ads = await Advertisement.find().sort({ uploadedAt: -1 });
    res.json(ads);
  } catch (err) {
    console.error("❌ FETCH ADS ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch advertisements" });
  }
});

/* ================= CREATE AD (ADMIN) =================
   POST /advertisements
======================================================= */
router.post("/", adminAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "Image is required" });
    }

    const Advertisement = mongoose.model("Advertisement");

    const ad = new Advertisement({
      imageUrl: req.file.path, // Cloudinary URL
      isActive: true,
    });

    await ad.save();
    res.json(ad);
  } catch (err) {
    console.error("❌ CREATE AD ERROR:", err);
    res.status(500).json({ msg: "Failed to upload advertisement" });
  }
});

/* ================= TOGGLE AD STATUS (ADMIN) =================
   PATCH /advertisements/:id/toggle
======================================================= */
router.patch("/:id/toggle", adminAuth, async (req, res) => {
  try {
    const Advertisement = mongoose.model("Advertisement");

    const ad = await Advertisement.findById(req.params.id);
    if (!ad) return res.status(404).json({ msg: "Advertisement not found" });

    ad.isActive = !ad.isActive;
    await ad.save();

    res.json(ad);
  } catch (err) {
    console.error("❌ TOGGLE AD ERROR:", err);
    res.status(500).json({ msg: "Failed to toggle ad" });
  }
});

/* ================= DELETE AD (ADMIN) =================
   DELETE /advertisements/:id
======================================================= */
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const Advertisement = mongoose.model("Advertisement");
    await Advertisement.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE AD ERROR:", err);
    res.status(500).json({ msg: "Failed to delete ad" });
  }
});

/* ================= PUBLIC ADS (STUDENT APP) =================
   GET /advertisements/public
   (NO AUTH – used by Android app)
======================================================= */
router.get("/public", async (req, res) => {
  try {
    const Advertisement = mongoose.model("Advertisement");

    const ads = await Advertisement.find({ isActive: true })
      .sort({ uploadedAt: -1 });

    res.json(ads);
  } catch (err) {
    console.error("❌ PUBLIC ADS ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch public advertisements" });
  }
});

module.exports = router;
