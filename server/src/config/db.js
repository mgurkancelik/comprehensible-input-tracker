const mongoose = require("mongoose");

// error.message içinde connection string veya şifre görünme ihtimaline karşı
// mesajı temizler. Önce bilinen URI değerini (varsa) birebir çıkarır, sonra
// genel "mongodb://" / "user:pass@" kalıplarını regex ile yakalar (fallback,
// mesaj URI'yi biraz farklı biçimde içerse bile yakalar).
function sanitizeErrorMessage(message, rawUri) {
  if (!message) {
    return message;
  }

  let safe = message;

  if (rawUri) {
    safe = safe.split(rawUri).join("[REDACTED_URI]");
  }

  safe = safe.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "[REDACTED_URI]");
  safe = safe.replace(/:\/\/[^/\s@]+:[^/\s@]+@/g, "://[REDACTED_CREDENTIALS]@");

  return safe;
}

// Sadece teşhis için güvenli olan alanları loglar: error.name, error.code,
// error.codeName ve sanitize edilmiş error.message. URI, kullanıcı adı veya
// şifre hiçbir koşulda buradan geçmez.
function logConnectionError(error) {
  console.error("MongoDB connection failed:", {
    name: error.name,
    code: error.code,
    codeName: error.codeName,
    message: sanitizeErrorMessage(error.message, process.env.MONGODB_URI),
  });
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
  } catch (error) {
    // Bağlantı hatasında process.exit YOK — sunucu ayakta kalmaya devam
    // eder, /api/health çalışır, /api/db-test 503 döner.
    logConnectionError(error);
  }
}

// İlk bağlantıdan sonra oluşabilecek kopmalarda da aynı güvenli formatla
// logla; uygulamayı çökertme.
mongoose.connection.on("error", logConnectionError);

module.exports = connectDB;
