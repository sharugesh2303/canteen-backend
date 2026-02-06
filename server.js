/* ======================================================
 * FILE: server.js
 * ====================================================== */

const express = require("express");
const cors = require("cors");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path"); // ✅ Added for reliable path handling
require("dotenv").config();

/* ======================================================
    LOAD MODELS
====================================================== */
require("./models/MenuItem");
require("./models/Order");
require("./models/Admin");
require("./models/DeliveryStaff");
require("./models/SubCategory");
require("./models/Advertisement");
require("./models/Feedback");
require("./models/ServiceHours");
require("./models/Offer");
require("./models/NotificationToken"); // ✅ FCM Tokens

/* ======================================================
    LOAD ROUTES
====================================================== */
const orderRoutes = require("./routes/orderRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const revenueRoutes = require("./routes/revenueRoutes");
const menuRoutes = require("./routes/menuRoutes");
const subCategoryRoutes = require("./routes/subcategories");
const advertisementRoutes = require("./routes/advertisementRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const serviceHoursRoutes = require("./routes/serviceHoursRoutes");
const offerRoutes = require("./routes/offerRoutes");

// ✅ STAFF ROUTES
const staffAuthRoutes = require("./routes/staffAuthRoutes");
const staffOrderRoutes = require("./routes/staffOrderRoutes");

// ✅ Notification routes
const notificationRoutes = require("./routes/notificationRoutes");

/* ======================================================
    VALIDATE ROUTERS (SAFETY CHECK)
====================================================== */
if (typeof offerRoutes !== "function") {
  console.error("❌ offerRoutes is NOT a router function");
  process.exit(1);
}
if (typeof staffAuthRoutes !== "function") {
  console.error("❌ staffAuthRoutes is NOT a router function");
  process.exit(1);
}
if (typeof staffOrderRoutes !== "function") {
  console.error("❌ staffOrderRoutes is NOT a router function");
  process.exit(1);
}
if (typeof notificationRoutes !== "function") {
  console.error("❌ notificationRoutes is NOT a router function");
  process.exit(1);
}

/* ======================================================
    APP & SERVER SETUP
====================================================== */
const app = express();
const server = http.createServer(app);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
  transports: ["websocket"],

  // 🔥 Prevent cloud proxy from killing idle sockets
  pingInterval: 25000,
  pingTimeout: 60000,
});

const PORT = process.env.PORT || 10000;

/* ======================================================
    GLOBAL MIDDLEWARE
====================================================== */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Static File Serving
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // ✅ Ensure image uploads are accessible

/* ======================================================
    DEVICE HASH HELPER
====================================================== */
function hashDeviceId(deviceId) {
  return crypto.createHash("sha256").update(deviceId).digest("hex");
}

/* ======================================================
    SOCKET MAP STORAGE (HASH ONLY)
====================================================== */
const studentSockets = new Map();
app.set("io", io);
app.set("studentSockets", studentSockets);

/* ======================================================
    DATABASE CONNECTION
===================================================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

/* ======================================================
    SHOP STATUS (GLOBAL STATE FOR CANTEEN & CAFETERIA)
===================================================== */
// ✅ Track status for both locations independently
let shopStatus = {
  canteen: true,
  cafeteria: true
};

// matches frontend calls to: /api/status/public?location=...
app.get("/api/status/public", (req, res) => {
  const loc = req.query.location || 'canteen';
  res.json({ isOpen: shopStatus[loc] !== undefined ? shopStatus[loc] : true });
});

// matches frontend calls to: /api/admin/status-toggle
app.patch("/api/admin/status-toggle", (req, res) => {
  const { location } = req.body;
  if (location && shopStatus[location] !== undefined) {
    shopStatus[location] = !shopStatus[location];
    console.log(`🔔 Status Update: ${location.toUpperCase()} is now ${shopStatus[location] ? 'OPEN' : 'CLOSED'}`);
    res.json({ isOpen: shopStatus[location], location });
  } else {
    res.status(400).json({ msg: "Invalid location provided" });
  }
});

/* ======================================================
    ROUTES REGISTRATION
===================================================== */

// ✅ Notifications
app.use("/api/notifications", notificationRoutes);

// ✅ Staff
app.use("/api/staff", staffAuthRoutes);
app.use("/api/staff", staffOrderRoutes);

// ✅ Orders (Student + Admin)
app.use("/api/orders", orderRoutes);

// ✅ Admin Modules
app.use("/api/admin", adminAuthRoutes);

// 🔥 FIXED: Changed from "/api/admin/revenue" to "/api/admin" 
// This allows the route in revenueRoutes.js (GET /daily-revenue) 
// to be accessed at /api/admin/daily-revenue as expected by the frontend.
app.use("/api/admin", revenueRoutes); 

app.use("/api/admin/advertisements", advertisementRoutes);
app.use("/api/admin/feedback", feedbackRoutes);

// ✅ Menu Management (Admin Sync logic handled here)
app.use("/api/admin/menu", menuRoutes); 
app.use("/api/admin/subcategories", subCategoryRoutes);

// ✅ Offers
app.use("/api/admin/offers", offerRoutes);
app.use("/api/offers", offerRoutes);

// ✅ Public APIs
app.use("/api/feedback", feedbackRoutes);
app.use("/api/menu", menuRoutes); // 🔥 Contains /public with time/location filtering
app.use("/api/subcategories", subCategoryRoutes);
app.use("/api", serviceHoursRoutes);

// ✅ Advertisement fallback
app.use("/advertisements", advertisementRoutes);

/* ======================================================
    SOCKET EVENTS (HASH ONLY SYSTEM)
===================================================== */
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("register_student", (payload) => {
    try {
      let deviceId = null;

      if (typeof payload === "string") deviceId = payload;
      else if (payload && typeof payload === "object") deviceId = payload.deviceId;

      if (!deviceId) {
        console.log("⚠️ register_student called without deviceId");
        return;
      }

      const hashed = deviceId.length === 64 ? deviceId : hashDeviceId(deviceId);

      const oldSocket = studentSockets.get(hashed);
      if (oldSocket && oldSocket !== socket.id) {
        console.log("♻️ Replacing old socket for:", hashed);
      }

      studentSockets.set(hashed, socket.id);

      console.log("📲 Student registered (HASH):", hashed, "->", socket.id);
      console.log("📌 Total Connected Students:", studentSockets.size);
    } catch (err) {
      console.error("❌ register_student error:", err.message);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", socket.id, "Reason:", reason);

    for (const [deviceId, sId] of studentSockets.entries()) {
      if (sId === socket.id) {
        studentSockets.delete(deviceId);
        console.log("🗑️ Removed mapping for:", deviceId);
      }
    }

    console.log("📌 Total Connected Students:", studentSockets.size);
  });
});

/* ======================================================
    HEALTH CHECK
===================================================== */
app.get("/", (req, res) => {
  res.send("✅ JJ Canteen Backend Running");
});

/* =====================================================
    START SERVER
===================================================== */
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});