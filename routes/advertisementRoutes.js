/* ======================================================
 * FILE: routes/advertisementRoutes.js
 * ====================================================== */

const express = require("express");
const mongoose = require("mongoose");
const adminAuth = require("../middleware/adminAuth");
const upload = require("../middleware/upload");

const router = express.Router();

/* =========================================================
    1. GET ALL ADS (ADMIN PANEL)
    Endpoint: GET /api/advertisements?location=canteen
    Supports filtering by location.
========================================================= */
router.get("/", adminAuth, async (req, res) => {
  try {
    const Advertisement = mongoose.model("Advertisement");
    const { location } = req.query;

    let query = {};
    // Filter by location if provided and not "all"
    if (location && location.toLowerCase() !== "all") {
      query.location = location.toLowerCase();
    }

    const ads = await Advertisement.find(query).sort({ uploadedAt: -1 });
    res.json(ads);
  } catch (err) {
    console.error("❌ FETCH ADS ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch advertisements" });
  }
});

/* =========================================================
    2. CREATE NEW AD (ADMIN ONLY)
    Endpoint: POST /api/advertisements
    Requires: multipart/form-data ('image' file and 'location' string)
========================================================= */
router.post("/", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const { location } = req.body;

    if (!req.file) {
      return res.status(400).json({ msg: "Image file is required" });
    }

    if (!location) {
      return res.status(400).json({ msg: "Location (canteen/cafeteria) is required" });
    }

    // Validate location value
    const validLocations = ['canteen', 'cafeteria'];
    if (!validLocations.includes(location.toLowerCase())) {
      return res.status(400).json({ msg: "Invalid location. Must be 'canteen' or 'cafeteria'" });
    }

    const Advertisement = mongoose.model("Advertisement");

    const ad = new Advertisement({
      imageUrl: req.file.path, // URL from Cloudinary or local storage path
      location: location.toLowerCase(), 
      isActive: true,
    });

    await ad.save();
    res.status(201).json(ad);
  } catch (err) {
    console.error("❌ CREATE AD ERROR:", err);
    res.status(500).json({ msg: "Failed to upload advertisement" });
  }
});

/* =========================================================
    3. TOGGLE AD STATUS (ADMIN ONLY)
    Endpoint: PATCH /api/advertisements/:id/toggle
========================================================= */
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
    res.status(500).json({ msg: "Failed to toggle ad status" });
  }
});

/* =========================================================
    4. DELETE AD (ADMIN ONLY)
    Endpoint: DELETE /api/advertisements/:id
========================================================= */
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const Advertisement = mongoose.model("Advertisement");
    const result = await Advertisement.findByIdAndDelete(req.params.id);
    
    if (!result) return res.status(404).json({ msg: "Advertisement not found" });
    
    res.json({ success: true, msg: "Advertisement deleted successfully" });
  } catch (err) {
    console.error("❌ DELETE AD ERROR:", err);
    res.status(500).json({ msg: "Failed to delete ad" });
  }
});

/* =========================================================
    5. PUBLIC ADS (STUDENT ANDROID APP)
    Endpoint: GET /api/advertisements/public?location=canteen
    No Authentication required.
========================================================= */
router.get("/public", async (req, res) => {
  try {
    const { location } = req.query;
    const Advertisement = mongoose.model("Advertisement");

    let query = { isActive: true };
    
    // Enforce location filtering for the student app
    if (location && location.toLowerCase() !== "all") {
      query.location = location.toLowerCase();
    } else {
      // Default fallback if no location is specified (optional)
      // query.location = "canteen"; 
    }

    const ads = await Advertisement.find(query).sort({ uploadedAt: -1 });

    res.json(ads);
  } catch (err) {
    console.error("❌ PUBLIC ADS ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch public advertisements" });
  }
});

module.exports = router;