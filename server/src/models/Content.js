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

const contentSchema = new mongoose.Schema(
  {
    id: { type: String, index: true },
    title: { type: String, trim: true },
    name: { type: String, trim: true },
    type: { type: String, trim: true },
    status: { type: String, trim: true },
    totalEpisodes: {
      type: Number,
      default: 0,
      min: [0, "totalEpisodes negatif olamaz"],
    },
    watchedEpisodes: { type: Number, default: 0 },
    episodeDuration: { type: Number, default: 0 },
    wordsPerEpisode: { type: Number, default: 0 },
    startDate: { type: String, default: "" },
    targetDate: { type: String, default: "" },
    finishDate: { type: String, default: "" },
    poster: { type: String, default: "" },
    overview: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    tmdbId: { type: Number, index: true },
    mediaType: { type: String, trim: true },
    notes: { type: String, default: "" },
    watchLogs: { type: [watchLogSchema], default: [] },
    seasons: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  {
    timestamps: true,
    // Frontend tarafında zamanla eklenebilecek ek alanları (ör. eski/yeni
    // isimlendirme farkları) sessizce kaybetmemek için şema esnek tutulur.
    strict: false,
  }
);

module.exports = mongoose.model("Content", contentSchema);
