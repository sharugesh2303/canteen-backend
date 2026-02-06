const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

/**
 * GET /api/admin/daily-revenue?date=YYYY-MM-DD&location=canteen
 * * Fetches total orders, total revenue, and product-wise breakdown 
 * for a specific date and location.
 */
router.get("/daily-revenue", async (req, res) => {
  try {
    const { date, location } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    // Reference the Order model
    const Order = mongoose.model("Order");

    // Define time boundaries for the selected date in local time
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    // Build dynamic query
    // Includes "Delivered" and "Paid" to capture all successful transactions
    const query = {
      createdAt: { $gte: start, $lte: end },
      paymentStatus: { $in: ["Paid", "PAID", "Delivered"] } 
    };

    // Filter by location if provided (e.g., 'canteen' or 'cafeteria')
    // If location is 'all', we skip this filter to show aggregate data
    if (location && location !== "all") {
      query.location = location;
    }

    const orders = await Order.find(query);

    let totalOrders = orders.length;
    let totalRevenue = 0;
    const productMap = {};

    orders.forEach(order => {
      // Accumulate total daily revenue
      totalRevenue += (order.totalAmount || 0);

      // Breakdown revenue by individual product items
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const key = item.name;

          if (!productMap[key]) {
            productMap[key] = {
              name: item.name,
              quantity: 0,
              revenue: 0
            };
          }

          const itemPrice = item.unitPrice || item.price || 0;
          productMap[key].quantity += (item.quantity || 0);
          productMap[key].revenue += (item.quantity || 0) * itemPrice;
        });
      }
    });

    // Send response
    res.json({
      date,
      location: location || "all",
      totalOrders,
      totalRevenue,
      // Matches frontend useMemo(data.productSales) logic
      productSales: Object.values(productMap)
    });

  } catch (err) {
    console.error("❌ DAILY REVENUE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch revenue data" });
  }
});

module.exports = router;