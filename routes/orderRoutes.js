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

// ✅ Notification token model
const NotificationToken = require("../models/NotificationToken");

// ✅ Firebase Admin init
const admin = require("../firebase/firebaseAdmin");

/* =========================================================
    ✅ helper: detect if deviceId already hashed (sha256)
========================================================= */
function isAlreadyHashedDeviceId(deviceId) {
  return typeof deviceId === "string" && /^[a-f0-9]{64}$/i.test(deviceId);
}

/* =========================================================
    ✅ helper: safe rupee formatter
========================================================= */
function rupee(n) {
  const num = Number(n || 0);
  return num.toFixed(0);
}

/* =========================================================
    ✅ helper: check all items delivered
========================================================= */
function allItemsDelivered(order) {
  const items = order.items || [];
  if (items.length === 0) return false;
  return items.every((it) => it.delivered === true);
}

/* =========================================================
    1. GET ALL ORDERS (ADMIN ONLY)
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
    ✅ MARK ORDER READY + SEND SOCKET + SEND FCM PUSH
========================================================= */
router.patch("/admin/:billNumber/mark-ready", adminAuth, async (req, res) => {
  try {
    const { billNumber } = req.params;

    const order = await Order.findOne({ billNumber });
    if (!order) return res.status(404).json({ message: "Order not found" });

    // ✅ block delivered bills
    if (order.orderStatus === "DELIVERED") {
      return res.status(400).json({
        message: "This bill is already DELIVERED. Cannot mark READY again.",
      });
    }

    order.orderStatus = "READY";
    await order.save();

    /* =========================================================
        ✅ SEND SOCKET NOTIFICATION
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
      }
    } else {
      console.log("⚠️ Socket not available or missing deviceId");
    }

    /* =========================================================
        ✅ SEND PUSH NOTIFICATION (FCM)
    ========================================================= */
    try {
      if (!order.deviceId) {
        console.log("⚠️ Order deviceId missing. Skipping FCM.");
      } else {
        const tokenDoc = await NotificationToken.findOne({
          deviceId: order.deviceId,
        });

        if (tokenDoc?.fcmToken) {
          await admin.messaging().send({
            token: tokenDoc.fcmToken,
            notification: {
              title: "Order Ready ✅",
              body: "Your order is ready! Please collect from counter.",
            },
            data: {
              billNumber: order.billNumber || "",
              status: "READY",
            },
          });

          console.log("✅ FCM order-ready notification sent");
        } else {
          console.log("⚠️ No FCM token registered for deviceId:", order.deviceId);
        }
      }
    } catch (fcmErr) {
      console.error("❌ FCM SEND ERROR:", fcmErr.message);
    }

    res.json({
      message: "✅ Order marked READY, student notified via socket + FCM",
      order,
    });
  } catch (err) {
    console.error("❌ MARK READY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
    ✅ MARK SINGLE ITEM DELIVERED (LOCK ONLY)
    ✅ IMPORTANT RULE:
        - ONLY READY bill can select items
        - DELIVERED bill cannot change
        - NO auto-delivered here
========================================================= */
router.patch(
  "/admin/:billNumber/items/:index/deliver",
  adminAuth,
  async (req, res) => {
    try {
      const { billNumber, index } = req.params;

      const order = await Order.findOne({ billNumber });
      if (!order) return res.status(404).json({ message: "Order not found" });

      // ✅ only READY allowed
      if (order.orderStatus !== "READY") {
        return res.status(400).json({
          message: `Only READY bills can be delivered. Current status: ${order.orderStatus}`,
          order,
        });
      }

      // ✅ block if already DELIVERED
      if (order.orderStatus === "DELIVERED") {
        return res.status(400).json({
          message: "This bill is already DELIVERED.",
          order,
        });
      }

      const idx = Number(index);

      if (!order.items || idx < 0 || idx >= order.items.length) {
        return res.status(400).json({ message: "Invalid item index" });
      }

      // ✅ Once delivered cannot undo
      if (order.items[idx].delivered === true) {
        return res.json({
          message: "Item already delivered (locked)",
          order,
        });
      }

      order.items[idx].delivered = true;
      order.items[idx].deliveredAt = new Date();

      // ✅ DO NOT auto set DELIVERED here
      await order.save();

      res.json({
        message: "✅ Item locked as delivered",
        allItemsDelivered: allItemsDelivered(order),
        order,
      });
    } catch (err) {
      console.error("❌ ITEM DELIVER ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* =========================================================
    ✅ MARK ENTIRE BILL DELIVERED (FINAL CONFIRM)
    RULES:
      - ONLY READY bill
      - only if ALL items delivered
========================================================= */
router.patch(
  "/admin/:billNumber/mark-delivered",
  adminAuth,
  async (req, res) => {
    try {
      const { billNumber } = req.params;

      const order = await Order.findOne({ billNumber });
      if (!order) return res.status(404).json({ message: "Order not found" });

      // ✅ already delivered
      if (order.orderStatus === "DELIVERED") {
        return res.status(400).json({
          message: "This bill is already DELIVERED",
          order,
        });
      }

      // ✅ only READY allowed
      if (order.orderStatus !== "READY") {
        return res.status(400).json({
          message: `Cannot mark delivered. Bill status is ${order.orderStatus}`,
          order,
        });
      }

      // ✅ must deliver all items first
      if (!allItemsDelivered(order)) {
        return res.status(400).json({
          message:
            "Cannot mark delivered. Some items are not delivered/selected yet.",
          order,
        });
      }

      order.orderStatus = "DELIVERED";
      order.deliveredAt = new Date();

      await order.save();

      res.json({
        message: "✅ Bill marked as DELIVERED",
        order,
      });
    } catch (err) {
      console.error("❌ MARK DELIVERED ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* =========================================================
    2. GET ORDERS (STUDENT – DEVICE BASED)
========================================================= */
router.get("/", async (req, res) => {
  try {
    const rawDeviceId = req.query.deviceId;

    if (!rawDeviceId) {
      return res
        .status(400)
        .json({ error: "deviceId query parameter is required" });
    }

    const deviceId = isAlreadyHashedDeviceId(rawDeviceId)
      ? rawDeviceId
      : hashDeviceId(rawDeviceId);

    const orders = await Order.find({ deviceId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("❌ FETCH STUDENT ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* =========================================================
    3. CREATE ORDER (POST-PAYMENT SUCCESS)
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
      return res.status(400).json({
        error: "deviceId is required to create an order",
      });
    }

    const deviceId = isAlreadyHashedDeviceId(incomingDeviceId)
      ? incomingDeviceId
      : hashDeviceId(incomingDeviceId);

    const mappedItems = (items || []).map((it) => ({
      itemId: it.itemId || it._id || null,
      name: it.name,
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice ?? it.price ?? 0),
      originalPrice: Number(it.originalPrice ?? 0),
      offerPercent: Number(it.offerPercent ?? 0),
      delivered: false,
      deliveredAt: null,
    }));

    const billNumber = "BILL-" + Date.now();
    const qrNumber = crypto.randomUUID();

    const qrUrl = `${
      process.env.BASE_URL || "http://localhost:10000"
    }/api/orders/bill/${qrNumber}`;

    const qrImage = await generateQrImage(qrUrl);

    const order = await Order.create({
      items: mappedItems,
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
      deliveredAt: null,
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("❌ ORDER CREATE ERROR:", err);
    res.status(400).json({ error: err.message });
  }
});

/* =========================================================
    4. DAILY REVENUE REPORT (ADMIN ONLY)
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

        const unit = Number(item.unitPrice ?? item.price ?? 0);
        productMap[item.name].revenue += unit * item.quantity;
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
    ✅ GET ORDER DETAILS BY QR (JSON)
========================================================= */
router.get("/details/:qrNumber", async (req, res) => {
  try {
    const order = await Order.findOne({ qrNumber: req.params.qrNumber });

    if (!order) return res.status(404).json({ message: "Invalid QR Code" });

    res.json({
      billNumber: order.billNumber,
      qrNumber: order.qrNumber,
      createdAt: order.createdAt,
      collectionTime: order.collectionTime,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      orderStatus: order.orderStatus,
      deliveredAt: order.deliveredAt || null,
      totalAmount: order.totalAmount,
      qrImage: order.qrImage,
      items: order.items || [],
    });
  } catch (err) {
    console.error("❌ ORDER DETAILS ERROR:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* =========================================================
    ✅ GET ORDER DETAILS BY BILL NUMBER (JSON)
========================================================= */
router.get("/details-by-bill/:billNumber", async (req, res) => {
  try {
    const billNumber = req.params.billNumber;

    const order = await Order.findOne({ billNumber });
    if (!order) return res.status(404).json({ message: "Bill not found" });

    res.json({
      billNumber: order.billNumber,
      qrNumber: order.qrNumber,
      createdAt: order.createdAt,
      collectionTime: order.collectionTime,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      orderStatus: order.orderStatus,
      deliveredAt: order.deliveredAt || null,
      totalAmount: order.totalAmount,
      qrImage: order.qrImage,
      items: order.items || [],
    });
  } catch (err) {
    console.error("❌ DETAILS BY BILL ERROR:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* =========================================================
    5. BILL PAGE (QR VIEW – PUBLIC)
========================================================= */
router.get("/bill/:qrNumber", async (req, res) => {
  try {
    const order = await Order.findOne({ qrNumber: req.params.qrNumber });

    if (!order) return res.status(404).send("<h1>Error: Invalid QR Code</h1>");

    const formattedDate = new Date(order.createdAt).toLocaleString("en-IN");

    const itemRows = (order.items || [])
      .map((it, index) => {
        const name = it.name || it.itemName || "Item";
        const qty = Number(it.quantity || 0);

        const unit = Number(it.unitPrice ?? it.price ?? 0);
        const original = Number(it.originalPrice ?? 0);
        const offer = Number(it.offerPercent ?? 0);

        const subtotal = unit * qty;

        const priceHtml =
          offer > 0 && original > unit
            ? `<span style="font-weight:700;">₹${rupee(unit)}</span>
               <span style="color:#999; text-decoration:line-through; font-size:12px; margin-left:6px;">
                 ₹${rupee(original)}
               </span>
               <span style="color:#e74c3c; font-size:11px; font-weight:700; margin-left:6px;">
                 ${offer}% OFF
               </span>`
            : `<span style="font-weight:700;">₹${rupee(unit)}</span>`;

        return `
          <tr>
            <td>${index + 1}</td>
            <td style="text-align:left;">${name}</td>
            <td style="text-align:center;">${qty}</td>
            <td style="text-align:right;">${priceHtml}</td>
            <td class="total-col" style="text-align:right;">₹${rupee(
              subtotal
            )}</td>
          </tr>
        `;
      })
      .join("");

    const deliveredBadge =
      order.orderStatus === "DELIVERED"
        ? `<div style="margin-top:10px; padding:10px; background:#e8fff0; border:1px solid #27ae60; color:#1e8449; font-weight:800; border-radius:10px; text-align:center;">
            ✅ Already Delivered
          </div>`
        : "";

    res.send(`
      <html>
        <head>
          <title>Canteen Bill - ${order.billNumber}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333; background:#fafafa; }
            .bill-container { max-width: 430px; margin: auto; border: 2px solid #eee; padding: 16px; border-radius: 14px; background:white; }
            .header { text-align: center; border-bottom: 2px dashed #eee; padding-bottom: 10px; }
            .qr-section { text-align: center; margin: 16px 0; }
            .qr-section img { width: 200px; height: 200px; }
            .details { margin-top: 10px; font-size: 14px; }
            .status-paid { color: #27ae60; font-weight: bold; }
            .status-fail { color:#e74c3c; font-weight:bold; }

            .total-row { font-size: 18px; font-weight: bold; color: #27ae60; border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px; }
            .total-col { color:#27ae60; font-weight:800; }

            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
            th, td { border-bottom: 1px solid #eee; padding: 8px; }
            th { background: #f5f5f5; text-align: left; }
            .footer { text-align:center; margin-top: 14px; font-size: 12px; color:#999; }
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

              <p>
                <b>Status:</b>
                <span class="${
                  order.paymentStatus === "PAID" ? "status-paid" : "status-fail"
                }">
                  ${order.paymentStatus}
                </span>
              </p>

              <p><b>Order Status:</b> ${order.orderStatus || "N/A"}</p>

              ${deliveredBadge}

              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th style="text-align:center;">Qty</th>
                    <th style="text-align:right;">Price</th>
                    <th style="text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows || `<tr><td colspan="5">No items</td></tr>`}
                </tbody>
              </table>

              <div class="total-row">
                Total Amount: ₹${rupee(order.totalAmount)}
              </div>
            </div>

            <div class="footer">
              Thank you ❤️ JJ Canteen
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
