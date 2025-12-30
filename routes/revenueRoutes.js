const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

/*
  GET /api/admin/daily-revenue?date=YYYY-MM-DD
*/
router.get("/daily-revenue", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const Order = mongoose.model("Order");

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
      paymentStatus: { $in: ["Paid", "Delivered"] }
    });

    let totalOrders = orders.length;
    let totalRevenue = 0;
    const productMap = {};

    orders.forEach(order => {
      totalRevenue += order.totalAmount;

      order.items.forEach(item => {
        const key = item.name;

        if (!productMap[key]) {
          productMap[key] = {
            name: item.name,
            quantity: 0,
            revenue: 0
          };
        }

        productMap[key].quantity += item.quantity;
        productMap[key].revenue += item.quantity * item.price;
      });
    });

    res.json({
      date,
      totalOrders,
      totalRevenue,
      products: Object.values(productMap)
    });

  } catch (err) {
    console.error("❌ DAILY REVENUE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch revenue data" });
  }
});

module.exports = router;
