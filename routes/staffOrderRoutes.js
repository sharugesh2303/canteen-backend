const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// ✅ GET STAFF ORDERS (Only NEW Paid Orders, not READY/COLLECTED)
router.get("/orders", async (req, res) => {
  try {
    const Order = mongoose.model("Order");

    console.log("✅ /api/staff/orders called");

    // ✅ debug counts
    const total = await Order.countDocuments({});
    console.log("📌 Total Orders Count:", total);

    const paidCount = await Order.countDocuments({ paymentStatus: "PAID" });
    console.log("✅ Paid Orders Count:", paidCount);

    // ✅ IMPORTANT FIX:
    // show only PAID orders which are NOT READY or COLLECTED
    const orders = await Order.find({
      paymentStatus: "PAID",
      orderStatus: { $in: ["PLACED", "PREPARING"] }, // ✅ ONLY active kitchen orders
    })
      .sort({ createdAt: 1 })
      .limit(100);

    console.log("✅ Orders fetched:", orders.length);

    res.json(orders);
  } catch (err) {
    console.error("❌ STAFF FETCH ORDERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
