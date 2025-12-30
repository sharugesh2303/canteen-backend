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
    const { name, price, category, stock, subCategory } = req.body;

    if (!req.file) {
      return res.status(400).json({ msg: "Image is required" });
    }

    const item = new MenuItem({
      name,
      price,
      category,
      stock,
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
    const items = await MenuItem.find().populate("subCategory", "name imageUrl");
    res.json(items);
  } catch (err) {
    console.error("❌ ADMIN MENU FETCH ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch menu items" });
  }
});

/* =====================================================
    🌍 GET MENU ITEMS (PUBLIC – UPDATED WITH OFFER LOGIC)
    GET /api/menu/public
===================================================== */
router.get("/public", async (req, res) => {
  try {
    const MenuItem = mongoose.model("MenuItem");
    const Offer = mongoose.model("Offer"); // Load Offer model

    /* ✅ ENSURE SINGLE SERVICE HOURS DOCUMENT */
    let hours = await ServiceHours.findOne();
    if (!hours) {
      hours = await ServiceHours.create({});
    }

    const allowBreakfast = isNowBetween(
      hours.breakfast.start,
      hours.breakfast.end
    );

    const allowLunch = isNowBetween(
      hours.lunch.start,
      hours.lunch.end
    );

    // 1. Fetch items and active offers
    const [items, activeOffers] = await Promise.all([
      MenuItem.find().populate("subCategory", "name imageUrl"),
      Offer.find({ isActive: true }) // Only get active campaigns
    ]);

    // 2. Map through items and calculate discounts
    const processedItems = items.map(item => {
      const itemObj = item.toObject();
      
      // Check if this specific item ID is in any active offer list
      const activeOffer = activeOffers.find(offer => 
        offer.applicableItems.some(id => id.toString() === item._id.toString())
      );

      if (activeOffer) {
        const discount = (itemObj.price * activeOffer.discountPercentage) / 100;
        return {
          ...itemObj,
          isOffer: true,
          originalPrice: itemObj.price, // Send the original price for strikethrough
          price: Math.round(itemObj.price - discount), // Send discounted price as primary price
          discountPercentage: activeOffer.discountPercentage
        };
      }

      // No offer found for this item
      return { 
        ...itemObj, 
        isOffer: false, 
        originalPrice: itemObj.price 
      };
    });

    // 3. Filter items based on service hours
    const filteredItems = processedItems.filter(item => {
      if (item.category === "Breakfast") return allowBreakfast;
      if (item.category === "Lunch") return allowLunch;
      return true; // Snacks, Stationery, Essentials
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

    if (!item) {
      return res.status(404).json({ msg: "Menu item not found" });
    }

    res.json(item);
  } catch (err) {
    console.error("❌ GET MENU BY ID ERROR:", err);
    res.status(500).json({ msg: "Failed to fetch menu item" });
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
      subCategory: req.body.subCategory || null,
    };

    if (req.file) {
      update.imageUrl = req.file.path;
    }

    const item = await MenuItem.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

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