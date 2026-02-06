const express = require("express");
const mongoose = require("mongoose");
const adminAuth = require("../middleware/adminAuth");
const upload = require("../middleware/upload");
const ServiceHours = require("../models/ServiceHours");
const { isNowBetween } = require("../utils/timeUtils");

const router = express.Router();

/* =====================================================
    CREATE MENU ITEM (ADMIN)
===================================================== */
router.post("/", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const MenuItem = mongoose.model("MenuItem");
    const { name, price, category, stock, subCategory, location } = req.body;

    if (!req.file) {
      return res.status(400).json({ msg: "Image is required" });
    }

    const item = new MenuItem({
      name,
      price,
      category,
      stock,
      location: location || "canteen",
      subCategory: subCategory || null,
      imageUrl: req.file.path,
    });

    await item.save();
    res.json(item);
  } catch (err) {
    console.error("❌ CREATE MENU ERROR:", err);
    res.status(500).json({ msg: "Failed to create menu item" });
  }
});

/* =====================================================
    GET ALL MENU ITEMS (ADMIN)
===================================================== */
router.get("/", adminAuth, async (req, res) => {
  try {
    const MenuItem = mongoose.model("MenuItem");
    const { mode } = req.query;

    let query = {};
    if (mode === "cafeteria") {
      query.location = "cafeteria";
    } else {
      query = { $or: [{ location: "canteen" }, { location: { $exists: false } }] };
    }

    const items = await MenuItem.find(query).populate("subCategory", "name imageUrl");
    res.json(items);
  } catch (err) {
    console.error("❌ ADMIN MENU FETCH ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch menu items" });
  }
});

/* =====================================================
    🌍 GET MENU ITEMS (PUBLIC)  ✅ FIXED
===================================================== */
router.get("/public", async (req, res) => {
  try {
    const MenuItem = mongoose.model("MenuItem");
    const Offer = mongoose.model("Offer");

    const location = req.query.location || "canteen"; // 🔥 FIX 1

    // 🔥 FIX 2: Get service hours based on location
    let hours = await ServiceHours.findOne({ location });

    if (!hours) {
      hours = await ServiceHours.create({
        location,
        breakfast: { start: "08:00", end: "11:00" },
        lunch: { start: "12:00", end: "15:00" }
      });
    }

    const allowBreakfast = isNowBetween(hours.breakfast.start, hours.breakfast.end);
    const allowLunch = isNowBetween(hours.lunch.start, hours.lunch.end);

    let query = {};
    if (location === "cafeteria") {
      query.location = "cafeteria";
    } else {
      query = { $or: [{ location: "canteen" }, { location: { $exists: false } }] };
    }

    const [items, activeOffers] = await Promise.all([
      MenuItem.find(query).populate("subCategory", "name imageUrl"),
      Offer.find({ isActive: true })
    ]);

    const processedItems = items.map(item => {
      const itemObj = item.toObject();
      const isAvailable = itemObj.stock > 0;

      const activeOffer = activeOffers.find(offer =>
        offer.applicableItems.some(id => id.toString() === item._id.toString())
      );

      if (activeOffer) {
        const discount = (itemObj.price * activeOffer.discountPercentage) / 100;
        return {
          ...itemObj,
          isAvailable,
          isOffer: true,
          originalPrice: itemObj.price,
          price: Math.round(itemObj.price - discount),
          discountPercentage: activeOffer.discountPercentage
        };
      }

      return {
        ...itemObj,
        isAvailable,
        isOffer: false,
        originalPrice: itemObj.price
      };
    });

    // 🔥 TIME FILTER BASED ON UPDATED HOURS
    const filteredItems = processedItems.filter(item => {
      if (item.category === "Breakfast") return allowBreakfast;
      if (item.category === "Lunch") return allowLunch;
      return true;
    });

    res.json(filteredItems);
  } catch (err) {
    console.error("❌ PUBLIC MENU ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch menu" });
  }
});

/* =====================================================
    GET SINGLE MENU ITEM (ADMIN)
===================================================== */
router.get("/:id", adminAuth, async (req, res) => {
  try {
    const MenuItem = mongoose.model("MenuItem");
    const item = await MenuItem.findById(req.params.id).populate(
      "subCategory",
      "name imageUrl"
    );

    if (!item) return res.status(404).json({ msg: "Menu item not found" });
    res.json(item);
  } catch (err) {
    console.error("❌ GET MENU BY ID ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch menu item" });
  }
});

/* =====================================================
    MENU SYNC EDIT
===================================================== */
router.patch("/menu-sync-edit", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const MenuItem = mongoose.model("MenuItem");
    const { matchName, price, category, subCategory, location, stock, existingImage } = req.body;

    const updateData = {
      price: Number(price),
      category: category,
      subCategory: subCategory || null,
    };

    if (req.file) {
      updateData.imageUrl = req.file.path;
    } else if (existingImage) {
      const rootUrl = process.env.API_ROOT_URL || 'http://localhost:5000';
      updateData.imageUrl = existingImage.replace(rootUrl, '');
    }

    const syncedItem = await MenuItem.findOneAndUpdate(
      { name: matchName, location: location },
      {
        $set: updateData,
        $setOnInsert: {
          name: matchName,
          location: location,
          stock: Number(stock) || 0
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(syncedItem);
  } catch (err) {
    console.error("❌ SYNC EDIT ERROR:", err);
    res.status(500).json({ msg: "Sync failed. Ensure item name matches exactly." });
  }
});

/* =====================================================
    UPDATE MENU ITEM (ADMIN)
===================================================== */
router.put("/:id", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const MenuItem = mongoose.model("MenuItem");

    const update = {
      name: req.body.name,
      price: req.body.price,
      category: req.body.category,
      stock: req.body.stock,
      location: req.body.location,
      subCategory: req.body.subCategory || null,
    };

    if (req.file) update.imageUrl = req.file.path;

    const item = await MenuItem.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(item);
  } catch (err) {
    console.error("❌ UPDATE MENU ERROR:", err);
    res.status(500).json({ msg: "Failed to update menu item" });
  }
});

/* =====================================================
    DELETE MENU ITEM (ADMIN)
===================================================== */
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const MenuItem = mongoose.model("MenuItem");
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE MENU ERROR:", err);
    res.status(500).json({ msg: "Failed to delete menu item" });
  }
});

module.exports = router;
