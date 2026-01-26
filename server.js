/* ======================================================
 * FILE: server.js
 * ====================================================== */

const express = require("express");
const cors = require("cors");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const crypto = require("crypto");
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
  pingInterval: 25000,   // send ping every 25s
  pingTimeout: 60000,    // allow 60s before considering dead
});


const PORT = process.env.PORT || 10000;

/* ======================================================
    GLOBAL MIDDLEWARE
====================================================== */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static("public"));

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
====================================================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

/* ======================================================
    ROUTES REGISTRATION
====================================================== */

// ✅ Notifications
app.use("/api/notifications", notificationRoutes);

// ✅ Staff
app.use("/api/staff", staffAuthRoutes);
app.use("/api/staff", staffOrderRoutes);

// ✅ Orders (Student + Admin)
app.use("/api/orders", orderRoutes);

// ✅ Admin Modules
app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin", revenueRoutes);
app.use("/api/admin/advertisements", advertisementRoutes);
app.use("/api/admin/feedback", feedbackRoutes);
app.use("/api/admin/menu", menuRoutes);
app.use("/api/admin/subcategories", subCategoryRoutes);

// ✅ Offers
app.use("/api/admin/offers", offerRoutes);
app.use("/api/offers", offerRoutes);

// ✅ Public APIs
app.use("/api/feedback", feedbackRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/subcategories", subCategoryRoutes);
app.use("/api", serviceHoursRoutes);

// ✅ Advertisement fallback
app.use("/advertisements", advertisementRoutes);

/* ======================================================
    CANTEEN STATUS (GLOBAL STATE)
====================================================== */
let canteenOpen = true;

app.get("/api/canteen-status/public", (req, res) => {
  res.json({ isOpen: canteenOpen });
});

app.patch("/api/admin/canteen-status", (req, res) => {
  canteenOpen = !canteenOpen;
  res.json({ isOpen: canteenOpen });
});

/* ======================================================
    PUBLIC MENU (STUDENT)
====================================================== */
app.get("/api/menu/public", async (req, res) => {
  try {
    const MenuItem = mongoose.model("MenuItem");

    const items = await MenuItem.find({ stock: { $gt: 0 } }).populate(
      "subCategory",
      "name imageUrl"
    );

    res.json(items);
  } catch (err) {
    console.error("❌ PUBLIC MENU FETCH ERROR:", err);
    res.status(500).json({ message: "Failed to fetch menu" });
  }
});

/* ======================================================
    SOCKET EVENTS (HASH ONLY SYSTEM)
====================================================== */
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

      // ✅ ALWAYS USE HASH ONLY
      const hashed = deviceId.length === 64 ? deviceId : hashDeviceId(deviceId);

      // ♻️ Replace old socket if reconnected
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
====================================================== */
app.get("/", (req, res) => {
  res.send("✅ JJ Canteen Backend Running");
});

/* ======================================================
    START SERVER
====================================================== */
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
