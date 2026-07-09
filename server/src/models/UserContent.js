const mongoose = require("mongoose");

const watchLogSchema = new mongoose.Schema(
  {
    date: String,
    minutes: Number,
    words: Number,
    title: String,
  },
  { _id: false }
);

const userContentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId zorunludur"],
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Content",
      required: [true, "contentId zorunludur"],
    },
    status: {
      type: String,
      enum: {
        values: ["watchlist", "watching", "completed", "dropped"],
        message: "status geçerli değerlerden biri olmalı (watchlist, watching, completed, dropped)",
      },
      default: "watchlist",
    },
    watchedMinutes: {
      type: Number,
      default: 0,
      min: [0, "watchedMinutes negatif olamaz"],
    },
    watchedPercentage: {
      type: Number,
      default: 0,
      min: [0, "watchedPercentage 0 ile 100 arasında olmalı"],
      max: [100, "watchedPercentage 0 ile 100 arasında olmalı"],
    },
    watchedEpisodes: {
      type: Number,
      default: 0,
      min: [0, "watchedEpisodes negatif olamaz"],
    },
    notes: { type: String, default: "" },
    watchLogs: { type: [watchLogSchema], default: [] },
    startDate: { type: String, default: "" },
    finishDate: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

// Aynı kullanıcı aynı içeriği iki kez ekleyemesin diye userId + contentId
// ikilisi birlikte tekil (unique) olmak zorunda.
userContentSchema.index({ userId: 1, contentId: 1 }, { unique: true });

module.exports = mongoose.model("UserContent", userContentSchema);
