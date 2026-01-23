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

// ✅ Notification Token model
require("./models/NotificationToken");

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
    VALIDATE ROUTES
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

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },

  // ✅ prefer websocket (stable for Android)
  transports: ["websocket"],
});

const PORT = process.env.PORT || 10000;

/* ======================================================
    GLOBAL MIDDLEWARE
====================================================== */
app.use(cors());

// ✅ JSON support
app.use(express.json());

// ✅ NEW (RECOMMENDED): urlencoded support (WebView HTML / forms safe)
app.use(express.urlencoded({ extended: true }));

// ✅ OPTIONAL: serve static files (logo/css for bill)
app.use("/public", express.static("public"));

/* ======================================================
    ✅ DEVICE HASH HELPER
====================================================== */
function hashDeviceId(deviceId) {
  return crypto.createHash("sha256").update(deviceId).digest("hex");
}

/* ======================================================
    ✅ SOCKET MAP STORAGE
====================================================== */
const studentSockets = new Map();

// expose io and map to all routes
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

// ✅ Register tokens for push notifications
app.use("/api/notifications", notificationRoutes);

// ✅ Staff Login/Register Routes
app.use("/api/staff", staffAuthRoutes);

// ✅ Staff Orders Route
app.use("/api/staff", staffOrderRoutes);

// ✅ Orders Route (Student & Admin)
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

// ✅ Public / Student APIs
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
    ✅ SOCKET EVENTS (REALTIME NOTIFICATION SYSTEM)
====================================================== */
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  /*
    Student should emit one of:
      socket.emit("register_student", { deviceId })
      socket.emit("register_student", deviceId)
  */
  socket.on("register_student", (payload) => {
    try {
      let deviceId = null;

      if (typeof payload === "string") {
        deviceId = payload;
      } else if (payload && typeof payload === "object") {
        deviceId = payload.deviceId;
      }

      if (!deviceId) {
        console.log("⚠️ register_student called without deviceId");
        return;
      }

      // ✅ store exact key
      studentSockets.set(deviceId, socket.id);

      // ✅ if incoming is raw, also store hashed
      const hashed = deviceId.length === 64 ? deviceId : hashDeviceId(deviceId);
      studentSockets.set(hashed, socket.id);

      console.log("✅ Student registered deviceId:", deviceId, "->", socket.id);
      console.log("✅ Student registered hashed :", hashed, "->", socket.id);
      console.log("📌 Total Connected Students:", studentSockets.size);
    } catch (err) {
      console.error("❌ register_student error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);

    // remove mapping for this socket
    for (const [deviceId, sId] of studentSockets.entries()) {
      if (sId === socket.id) {
        studentSockets.delete(deviceId);
        console.log("🗑️ Removed student mapping:", deviceId);
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
