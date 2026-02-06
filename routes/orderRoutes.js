/* ==================================
 * FILE: src/routes/orderRoutes.js
 * ================================== */

const express = require("express");
const mongoose = require("mongoose"); // ✅ Added to access MenuItem model
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
    1. GET ALL ORDERS (ADMIN ONLY) - FILTERED BY LOCATION
========================================================= */
router.get("/admin/all", adminAuth, async (req, res) => {
  try {
    const { location } = req.query;
    
    // Create filter object
    let filter = {};
    if (location && location !== "all") {
      filter.location = location; 
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });
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
        ✅ SEND SOCKET NOTIFICATION (Event: orderReady)
    ========================================================= */
    const io = req.app.get("io");
    const studentSockets = req.app.get("studentSockets");

    console.log("📌 Mark-ready deviceId in Order (hashed):", order.deviceId);

    if (io && studentSockets && order.deviceId) {
      const socketId = studentSockets.get(order.deviceId);

      if (socketId) {
        // 🔥 FIXED: Changed "order_ready" to "orderReady" to match Android App
        io.to(socketId).emit("orderReady", {
          billNumber: order.billNumber,
          message: "✅ Your order is ready! Please collect from counter.",
        });

        console.log("✅ orderReady sent to socket:", socketId);
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
              body: `Your order from JJ ${order.location || 'Canteen'} is ready!`,
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
========================================================= */
router.patch(
  "/admin/:billNumber/items/:index/deliver",
  adminAuth,
  async (req, res) => {
    try {
      const { billNumber, index } = req.params;

      const order = await Order.findOne({ billNumber });
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (order.orderStatus !== "READY") {
        return res.status(400).json({
          message: `Only READY bills can be delivered. Current status: ${order.orderStatus}`,
          order,
        });
      }

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

      if (order.items[idx].delivered === true) {
        return res.json({
          message: "Item already delivered (locked)",
          order,
        });
      }

      order.items[idx].delivered = true;
      order.items[idx].deliveredAt = new Date();

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
========================================================= */
router.patch(
  "/admin/:billNumber/mark-delivered",
  adminAuth,
  async (req, res) => {
    try {
      const { billNumber } = req.params;

      const order = await Order.findOne({ billNumber });
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (order.orderStatus === "DELIVERED") {
        return res.status(400).json({
          message: "This bill is already DELIVERED",
          order,
        });
      }

      if (order.orderStatus !== "READY") {
        return res.status(400).json({
          message: `Cannot mark delivered. Bill status is ${order.orderStatus}`,
          order,
        });
      }

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
    3. CREATE ORDER (POST-PAYMENT SUCCESS) ✅ REDUCES STOCK
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
      location // ✅ Capturing location from body
    } = req.body;

    const MenuItem = mongoose.model("MenuItem"); // ✅ Get MenuItem model

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

    // 🔥 STOCK REDUCTION LOGIC 🔥
    // Iterates through each item and reduces its available stock
    for (const item of mappedItems) {
      if (item.itemId) {
        await MenuItem.findByIdAndUpdate(item.itemId, {
          $inc: { stock: -item.quantity } // Subtract the quantity from available stock
        });
      }
    }

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
      location: location || "canteen", // ✅ Default to canteen if missing
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
    const { date, location } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date parameter is required" });
    }

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    let query = {
      createdAt: { $gte: start, $lte: end },
      paymentStatus: "PAID",
    };

    if (location && location !== "all") {
      query.location = location;
    }

    const orders = await Order.find(query);

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
      location: order.location,
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
      location: order.location,
      items: order.items || [],
    });
  } catch (err) {
    console.error("❌ DETAILS BY BILL ERROR:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* =========================================================
    🧑‍🍳 CHEF SCAN — STATUS BASED RESPONSE
========================================================= */
router.get("/scan/:qrNumber", async (req, res) => {
  try {
    const order = await Order.findOne({ qrNumber: req.params.qrNumber });

    if (!order) {
      return res.status(404).json({ message: "Invalid QR Code" });
    }

    // 🚫 Already Delivered → Warning only
    if (order.orderStatus === "DELIVERED") {
      return res.json({
        status: "DELIVERED",
        message: "⚠️ This order is already delivered",
        billNumber: order.billNumber,
      });
    }

    // ⏳ Still Placed → Not ready warning
    if (order.orderStatus === "PLACED") {
      return res.json({
        status: "PLACED",
        message: "⏳ Order is not ready yet",
        billNumber: order.billNumber,
      });
    }

    // ✅ Ready → Send full order details
    if (order.orderStatus === "READY") {
      return res.json({
        status: "READY",
        billNumber: order.billNumber,
        items: order.items,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        collectionTime: order.collectionTime,
        message: "✅ Order ready for delivery",
      });
    }

    res.status(400).json({ message: "Unknown order state" });
  } catch (err) {
    console.error("❌ CHEF SCAN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
    5. BILL PAGE (QR VIEW – DYNAMIC BRANDING)
========================================================= */
router.get("/bill/:qrNumber", async (req, res) => {
  try {
    const order = await Order.findOne({ qrNumber: req.params.qrNumber });

    if (!order) return res.status(404).send("<h1>Error: Invalid QR Code</h1>");

    const formattedDate = new Date(order.createdAt).toLocaleString("en-IN");
    const isDelivered = order.orderStatus === "DELIVERED";
    
    // ✅ Dynamic Branding based on location
    const brandName = order.location === "cafeteria" ? "JJ Cafeteria" : "JJ Canteen";

    const itemRows = (order.items || [])
      .map((it, index) => {
        const name = it.name || it.itemName || "Item";
        const qty = Number(it.quantity || 0);
        const unit = Number(it.unitPrice ?? it.price ?? 0);
        const subtotal = unit * qty;
        const itemDeliveredMark = it.delivered ? '<span style="color:#27ae60; margin-left:5px;">✅</span>' : '';

        return `
          <tr>
            <td>${index + 1}</td>
            <td style="text-align:left;">${name} ${itemDeliveredMark}</td>
            <td style="text-align:center;">${qty}</td>
            <td style="text-align:right;">₹${rupee(unit)}</td>
            <td class="total-col" style="text-align:right;">₹${rupee(subtotal)}</td>
          </tr>
        `;
      })
      .join("");

    res.send(`
      <html>
        <head>
          <title>${brandName} Bill - ${order.billNumber}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333; background:#fafafa; }
            .bill-container { max-width: 430px; margin: auto; border: 2px solid #eee; padding: 16px; border-radius: 14px; background:white; position: relative; }
            .header { text-align: center; border-bottom: 2px dashed #eee; padding-bottom: 10px; }
            
            /* Fixed QR & Stamp Logic */
            .qr-wrapper { 
              position: relative; 
              display: inline-block; 
              width: 220px; 
              height: 220px; 
              margin: 20px auto;
            }
            .qr-wrapper img { 
              width: 100%; 
              height: 100%; 
              display: block;
            }
            
            .delivered-stamp {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-20deg);
              border: 6px double #e74c3c;
              color: #e74c3c;
              font-size: 28px;
              font-weight: 900;
              padding: 8px 15px;
              text-transform: uppercase;
              border-radius: 4px;
              background: rgba(255, 255, 255, 0.8);
              z-index: 99;
              white-space: nowrap;
              pointer-events: none;
              font-family: 'Courier New', Courier, monospace;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }

            .qr-outer { text-align: center; }
            .details { margin-top: 15px; font-size: 14px; }
            .status-paid { color: #27ae60; font-weight: bold; background: #e8f8f0; padding: 2px 6px; border-radius: 4px; }
            .total-row { font-size: 18px; font-weight: bold; color: #27ae60; border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
            th, td { border-bottom: 1px solid #eee; padding: 8px; }
            th { background: #f5f5f5; text-align: left; }
            .footer { text-align:center; margin-top: 14px; font-size: 12px; color:#999; }
          </style>
        </head>
        <body>
          <div class="bill-container">
            <div class="header">
              <h2 style="margin:0;">🧾 ${brandName} Bill</h2>
              <p style="margin:5px 0;">${formattedDate}</p>
            </div>

            <div class="qr-outer">
              <div class="qr-wrapper">
                <img src="${order.qrImage}" alt="Order QR"/>
                ${isDelivered ? '<div class="delivered-stamp">DELIVERED</div>' : ''}
              </div>
              <p><strong>${isDelivered ? 'Order Collected ✅' : 'Scan at Counter'}</strong></p>
            </div>

            <div class="details">
              <p><b>Bill No:</b> ${order.billNumber}</p>
              <p><b>Collection:</b> ${order.collectionTime}</p>
              <p><b>Payment:</b> ${order.paymentMethod}</p>
              <p><b>Status:</b> <span class="status-paid">${order.paymentStatus}</span></p>
              <p><b>Order Status:</b> ${order.orderStatus}</p>
              
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
                  ${itemRows}
                </tbody>
              </table>
              <div class="total-row">
                Total Amount: ₹${rupee(order.totalAmount)}
              </div>
            </div>
            <div class="footer">
              Thank you ❤️ ${brandName}
              ${isDelivered ? `<br><span style="color:#27ae60">Delivered on ${new Date(order.deliveredAt).toLocaleString("en-IN")}</span>` : ''}
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