require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const contentsRoutes = require("./routes/contents");
const usersRoutes = require("./routes/users");
const userContentsRoutes = require("./routes/userContents");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 5000;

const devOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

const envOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = envOrigins.length > 0 ? [...envOrigins, ...devOrigins] : devOrigins;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS bu origin için izinli değil: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());

connectDB();

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Server is running" });
});

app.use("/api/contents", contentsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/user-contents", userContentsRoutes);
app.use("/api/auth", authRoutes);

app.get("/api/db-test", (req, res) => {
  const readyState = mongoose.connection.readyState;

  if (readyState === 1) {
    res.json({ ok: true, message: "MongoDB connection successful" });
    return;
  }

  res
    .status(503)
    .json({ ok: false, message: "MongoDB connection unavailable", readyState });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
