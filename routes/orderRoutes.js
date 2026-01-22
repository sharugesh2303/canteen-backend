/* ==================================
 * FILE: src/routes/orderRoutes.js
 * ================================== */

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Order = require("../models/Order");
const { generateQrImage } = require("../utils/qr");
const { hashDeviceId } = require("../utils/hash");
const adminAuth = require("../middleware/adminAuth");

/* =========================================================
    ✅ helper: detect if deviceId already hashed (sha256)
========================================================= */
function isAlreadyHashedDeviceId(deviceId) {
  // sha256 hex length = 64
  return typeof deviceId === "string" && /^[a-f0-9]{64}$/i.test(deviceId);
}

/* =========================================================
    1. GET ALL ORDERS (ADMIN ONLY)
    Endpoint: GET /api/orders/admin/all
========================================================= */
router.get("/admin/all", adminAuth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("❌ ADMIN FETCH ALL ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch all orders" });
  }
});

/* =========================================================
    ✅ MARK ORDER READY + SEND SOCKET NOTIFICATION
    Endpoint: PATCH /api/orders/admin/:billNumber/mark-ready
========================================================= */
router.patch("/admin/:billNumber/mark-ready", adminAuth, async (req, res) => {
  try {
    const { billNumber } = req.params;

    const order = await Order.findOne({ billNumber });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ✅ Update order status
    order.orderStatus = "READY";
    await order.save();

    /* =========================================================
        ✅ SEND REALTIME NOTIFICATION TO STUDENT (SOCKET.IO)
    ========================================================= */
    const io = req.app.get("io");
    const studentSockets = req.app.get("studentSockets");

    console.log("📌 Mark-ready deviceId in Order (hashed):", order.deviceId);

    if (io && studentSockets && order.deviceId) {
      const socketId = studentSockets.get(order.deviceId);

      if (socketId) {
        io.to(socketId).emit("order_ready", {
          billNumber: order.billNumber,
          message: "✅ Your order is ready! Please collect from counter.",
        });

        console.log("✅ order_ready sent to socket:", socketId);
      } else {
        console.log("⚠️ Student NOT connected for deviceId:", order.deviceId);
        console.log(
          "📌 Connected deviceIds:",
          Array.from(studentSockets.keys()).slice(0, 5),
          studentSockets.size > 5 ? `... +${studentSockets.size - 5} more` : ""
        );
      }
    } else {
      console.log("⚠️ Socket not available or missing deviceId");
    }

    res.json({
      message: "✅ Order marked as READY and student notified",
      order,
    });
  } catch (err) {
    console.error("❌ MARK READY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
    2. GET ORDERS (STUDENT – DEVICE BASED)
    Endpoint: GET /api/orders?deviceId=xxxx
========================================================= */
router.get("/", async (req, res) => {
  try {
    const rawDeviceId = req.query.deviceId;

    if (!rawDeviceId) {
      return res
        .status(400)
        .json({ error: "deviceId query parameter is required" });
    }

    // ✅ Accept both raw or already-hashed
    const deviceId = isAlreadyHashedDeviceId(rawDeviceId)
      ? rawDeviceId
      : hashDeviceId(rawDeviceId);

    const orders = await Order.find({ deviceId }).sort({
      createdAt: -1,
    });

    res.json(orders);
  } catch (err) {
    console.error("❌ FETCH STUDENT ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* =========================================================
    3. CREATE ORDER (POST-PAYMENT SUCCESS)
    Endpoint: POST /api/orders
========================================================= */
router.post("/", async (req, res) => {
  try {
    const {
      items,
      totalAmount,
      collectionTime,
      paymentMethod,
      paymentStatus,
      paymentId,
      deviceId: incomingDeviceId,
    } = req.body;

    if (!incomingDeviceId) {
      return res
        .status(400)
        .json({ error: "deviceId is required to create an order" });
    }

    // ✅ If frontend already sends hashed id, don't hash again
    const deviceId = isAlreadyHashedDeviceId(incomingDeviceId)
      ? incomingDeviceId
      : hashDeviceId(incomingDeviceId);

    console.log("📌 ORDER CREATE incomingDeviceId:", incomingDeviceId);
    console.log("📌 ORDER CREATE stored deviceId (hashed):", deviceId);

    // Generate unique identifiers
    const billNumber = "BILL-" + Date.now();
    const qrNumber = crypto.randomUUID();

    const qrUrl = `${
      process.env.BASE_URL || "http://localhost:10000"
    }/api/orders/bill/${qrNumber}`;

    const qrImage = await generateQrImage(qrUrl);

    const order = await Order.create({
      items,
      totalAmount,
      collectionTime,
      paymentMethod,
      paymentStatus,
      paymentId,
      deviceId,
      billNumber,
      qrNumber,
      qrImage,
      qrVisibleAt: new Date(),
      orderStatus: "PLACED",
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("❌ ORDER CREATE ERROR:", err);
    res.status(400).json({ error: err.message });
  }
});

/* =========================================================
    4. DAILY REVENUE REPORT (ADMIN ONLY)
    Endpoint: GET /api/orders/admin/daily-revenue?date=YYYY-MM-DD
========================================================= */
router.get("/admin/daily-revenue", adminAuth, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date parameter is required" });
    }

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
      paymentStatus: "PAID",
    });

    let totalRevenue = 0;
    const productMap = {};

    orders.forEach((order) => {
      totalRevenue += order.totalAmount;

      order.items.forEach((item) => {
        if (!productMap[item.name]) {
          productMap[item.name] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        productMap[item.name].quantity += item.quantity;
        productMap[item.name].revenue += item.price * item.quantity;
      });
    });

    res.json({
      date,
      totalOrders: orders.length,
      totalRevenue,
      productSales: Object.values(productMap),
    });
  } catch (err) {
    console.error("❌ DAILY REVENUE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch revenue data" });
  }
});

/* =========================================================
    5. BILL PAGE (QR VIEW – PUBLIC)
    Endpoint: GET /api/orders/bill/:qrNumber
========================================================= */
router.get("/bill/:qrNumber", async (req, res) => {
  try {
    const order = await Order.findOne({ qrNumber: req.params.qrNumber });

    if (!order) {
      return res.status(404).send("<h1>Error: Invalid QR Code</h1>");
    }

    const formattedDate = new Date(order.createdAt).toLocaleString("en-IN");

    res.send(`
      <html>
        <head>
          <title>Canteen Bill - ${order.billNumber}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333; }
            .bill-container { max-width: 400px; margin: auto; border: 2px solid #eee; padding: 20px; border-radius: 10px; }
            .header { text-align: center; border-bottom: 2px dashed #eee; padding-bottom: 10px; }
            .qr-section { text-align: center; margin: 20px 0; }
            .qr-section img { width: 220px; height: 220px; }
            .details { margin-top: 15px; font-size: 14px; }
            .total-row { font-size: 18px; font-weight: bold; color: #e67e22; border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px; }
            .status-paid { color: #27ae60; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="bill-container">
            <div class="header">
              <h2>🧾 JJ Canteen Bill</h2>
              <p>${formattedDate}</p>
            </div>
            <div class="qr-section">
              <img src="${order.qrImage}" alt="Order QR"/>
              <p><strong>Scan at Counter</strong></p>
            </div>
            <div class="details">
              <p><b>Bill No:</b> ${order.billNumber}</p>
              <p><b>Collection:</b> ${order.collectionTime}</p>
              <p><b>Payment:</b> ${order.paymentMethod}</p>
              <p><b>Status:</b> <span class="status-paid">${order.paymentStatus}</span></p>
              <p><b>Order Status:</b> ${order.orderStatus || "N/A"}</p>
              <div class="total-row">
                Total Amount: ₹${order.totalAmount}
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("❌ BILL PAGE ERROR:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
