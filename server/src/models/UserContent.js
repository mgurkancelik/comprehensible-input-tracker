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
    // Kullanıcıya özel toplam bölüm bilgisi. Content.totalEpisodes (katalog)
    // paylaşılan/genel bir fallback olarak kalır, ama TMDb sezon
    // senkronizasyonundan bulunan gerçek değer artık buraya (JWT/ownership
    // korumalı UserContent kaydına) yazılır — böylece bir kullanıcının
    // senkronizasyonu başka bir kullanıcının veya global kataloğun verisini
    // etkilemez. Üst sınır (100000) en uzun soluklu dizi/animeleri (örn.
    // Sazae-san ~2700, One Piece ~1100 bölüm) kapsayacak kadar geniş, ama
    // anlamsız/kötüye kullanım amaçlı aşırı büyük değerleri (10^9 gibi)
    // reddedecek kadar dar tutulan, açıklanabilir bir güvenlik sınırıdır.
    totalEpisodes: {
      type: Number,
      default: 0,
      min: [0, "totalEpisodes negatif olamaz"],
      max: [100000, "totalEpisodes çok büyük bir değer"],
      validate: {
        validator: Number.isInteger,
        message: "totalEpisodes tam sayı olmalı",
      },
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
