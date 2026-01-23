const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// ✅ GET STAFF ORDERS (Only NEW Paid Orders, not READY/COLLECTED)
router.get("/orders", async (req, res) => {
  try {
    const Order = mongoose.model("Order");

    
    // ✅ debug counts
    const total = await Order.countDocuments({});
    

    const paidCount = await Order.countDocuments({ paymentStatus: "PAID" });
    

    // ✅ IMPORTANT FIX:
    // show only PAID orders which are NOT READY or COLLECTED
    const orders = await Order.find({
      paymentStatus: "PAID",
      orderStatus: { $in: ["PLACED", "PREPARING"] }, // ✅ ONLY active kitchen orders
    })
      .sort({ createdAt: 1 })
      .limit(100);

    
    res.json(orders);
  } catch (err) {
    console.error("❌ STAFF FETCH ORDERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
