/* ======================================================
 * FILE: server.js
 * ====================================================== */

const express = require("express");
const cors = require("cors");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
require("dotenv").config();

/* ======================================================
    LOAD MODELS
    (Must be loaded before routes to avoid MissingSchemaError)
====================================================== */
require("./models/MenuItem");
require("./models/Order");
require("./models/Admin");
require("./models/DeliveryStaff");
require("./models/SubCategory");
require("./models/Advertisement");
require("./models/Feedback");
require("./models/ServiceHours");

/* ✅ OFFERS MODEL */
require("./models/Offer");

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

/* ✅ OFFERS ROUTES */
const offerRoutes = require("./routes/offerRoutes");

/* ======================================================
    VALIDATE ROUTES (🔥 CRITICAL FIX)
====================================================== */
if (typeof offerRoutes !== "function") {
  console.error("❌ offerRoutes is NOT a router function");
  console.error("👉 Check routes/offerRoutes.js export");
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
});

const PORT = process.env.PORT || 10000;

/* ======================================================
    GLOBAL MIDDLEWARE
====================================================== */
app.use(cors());
app.use(express.json());

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

// 1. Orders (Student & Admin)
app.use("/api/orders", orderRoutes);

// 2. Admin Modules
app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin", revenueRoutes);
app.use("/api/admin/advertisements", advertisementRoutes);
app.use("/api/admin/feedback", feedbackRoutes);
app.use("/api/admin/menu", menuRoutes);
app.use("/api/admin/subcategories", subCategoryRoutes);

/* ✅ ADMIN OFFERS */
app.use("/api/admin/offers", offerRoutes);

// 3. Public / Student APIs
app.use("/api/feedback", feedbackRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/subcategories", subCategoryRoutes);
app.use("/api", serviceHoursRoutes); // /service-hours/public

// 4. Advertisement fallback
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

    const items = await MenuItem.find({ stock: { $gt: 0 } })
      .populate("subCategory", "name imageUrl");

    res.json(items);
  } catch (err) {
    console.error("❌ PUBLIC MENU FETCH ERROR:", err);
    res.status(500).json({ message: "Failed to fetch menu" });
  }
});

/* ======================================================
    SOCKET EVENTS
====================================================== */
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
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
