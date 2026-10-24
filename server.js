require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const organizationRoutes = require("./routes/OrganizationRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");

const app = express();

connectDB();

app.set("trust proxy", 1);

// Configure CORS for both local development and network testing
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://192.168.88.6:3000",
  "http://192.168.88.5:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://192.168.")) {
        callback(null, true);
      } else {
        callback(null, true); // Dev-friendly
      }
    },
    credentials: true,
  })
);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan("tiny"));

app.use(express.json());
app.use(cookieParser());

// API Routes
 const apiVersion = 'v1';
app.use(`/api/${apiVersion}/auth`, authRoutes);
app.use(`/api/${apiVersion}/users`, userRoutes);
app.use(`/api/${apiVersion}/organizations`, organizationRoutes);
app.use(`/api/${apiVersion}/vendors`, vendorRoutes);
app.use(`/api/${apiVersion}/invoices`, invoiceRoutes);

app.get(`/api/${apiVersion}/health`, (req, res) => {
  res.json({
    status: "ok",
    message: "Multi-Tenant Vendor Management API is running",
    timestamp: new Date().toISOString(),
  });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error.",
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("SIGINT", async () => {
  await mongoose.connection.close();
  server.close(() => {
    process.exit(0);
  });
});