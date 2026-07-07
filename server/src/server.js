require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

connectDB();

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Server is running" });
});

app.get("/api/db-test", (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;

  if (isConnected) {
    res.json({ ok: true, message: "MongoDB connection successful" });
    return;
  }

  res.status(503).json({ ok: false, message: "MongoDB connection unavailable" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
