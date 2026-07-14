const Content = require("../models/Content");

// error.message'ı olduğu gibi client'a döndürmüyoruz; sadece bilinen ve
// güvenli (secret içermeyen) hata tiplerinde mesajı geçiriyoruz, aksi halde
// genel bir mesaj dönüyoruz. Ayrıntı yalnızca sunucu logunda kalır.
function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage + ":", error.name, error.message);

  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ ok: false, message: error.message });
  }

  return res.status(500).json({ ok: false, message: fallbackMessage });
}

// findOrCreateBackendContentFromLocal (frontend) POST /contents ile
// yalnızca bu alanları gönderiyor. Bunun dışında kalan hiçbir alan (örn.
// status, notes, watchLogs, seasons) bu yoldan global katalog kaydına
// yazılamaz — Content.js'in strict:false olması bu whitelist'in önemini
// artırıyor (şema seviyesinde otomatik bir filtre yok).
const ALLOWED_CONTENT_FIELDS = [
  "title",
  "name",
  "type",
  "mediaType",
  "tmdbId",
  "poster",
  "posterUrl",
  "overview",
  "rating",
  "tmdbRating",
  "totalEpisodes",
  "episodeDuration",
  "wordsPerEpisode",
];

function pickAllowedFields(source, allowedFields) {
  const picked = {};

  allowedFields.forEach((field) => {
    if (source && Object.prototype.hasOwnProperty.call(source, field)) {
      picked[field] = source[field];
    }
  });

  return picked;
}

async function getContents(req, res) {
  try {
    const contents = await Content.find().sort({ createdAt: -1 });
    res.json({ ok: true, count: contents.length, data: contents });
  } catch (error) {
    handleError(res, error, "Failed to fetch contents");
  }
}

async function createContent(req, res) {
  try {
    const payload = pickAllowedFields(req.body, ALLOWED_CONTENT_FIELDS);
    const created = await Content.create(payload);
    res.status(201).json({ ok: true, data: created });
  } catch (error) {
    handleError(res, error, "Failed to create content");
  }
}

// Global katalog kaydını güncelleme/silme/toplu ekleme, admin veya rol
// sistemi olmadan hiçbir kullanıcıya (giriş yapmış olsa da) açık
// bırakılmıyor — bu değişiklikler TÜM kullanıcıları etkiler, tek başına
// requireAuth (route seviyesinde uygulanıyor) yeterli değildir. Şu an
// frontend'de bu endpoint'leri çağıran gerçek bir akış yok; meşru bir admin
// ihtiyacı doğarsa burası gerçek bir admin/rol kontrolüyle yeniden açılabilir.
function updateContent(req, res) {
  res.status(403).json({ ok: false, message: "Bu işlem için yetkiniz yok." });
}

function deleteContent(req, res) {
  res.status(403).json({ ok: false, message: "Bu işlem için yetkiniz yok." });
}

// Aynı gerekçeyle (admin/rol sistemi yok) kapatılmıştır — bkz. yukarıdaki not.
function bulkImportContents(req, res) {
  res.status(403).json({ ok: false, message: "Bu işlem için yetkiniz yok." });
}

// Gerçekçi bir film/uzun metraj süresi üst sınırı (20 saat) — kötüye
// kullanım amaçlı anlamsız büyük değerleri reddetmek için, totalEpisodes'taki
// açıklanabilir sınır mantığıyla aynı yaklaşım (bkz. UserContent.js).
const MAX_MOVIE_RUNTIME_MINUTES = 1200;

function normalizeIncomingRuntimeMinutes(rawValue) {
  const numberValue = Number(rawValue);

  if (
    !Number.isFinite(numberValue) ||
    numberValue <= 0 ||
    numberValue > MAX_MOVIE_RUNTIME_MINUTES
  ) {
    return null;
  }

  return Math.round(numberValue);
}

// updateContent (global PUT) kasıtlı olarak kapalı kalır — bu onun yerine
// GEÇMEZ. Bu, yalnızca EKSİK (boş/0) bir film süresini, doğrulanmış
// tmdbId + mediaType eşleşmesiyle tamamlayan, dar kapsamlı ve whitelist'li
// bir akıştır:
// - Yalnızca mediaType "movie" için çalışır.
// - Gönderilen tmdbId, kaydın kendi tmdbId'siyle birebir eşleşmezse reddedilir
//   (yanlış içeriğe yazma ihtimalini ortadan kaldırır).
// - Kayıtta zaten geçerli (>0) bir episodeDuration varsa HİÇBİR ŞEY
//   değiştirmez (sessizce mevcut değeri döner) — kullanıcı/TMDb kaynaklı
//   gerçek bir süre asla ezilmez.
// - episodeDuration dışında hiçbir alana dokunmaz; userId/UserContent'e hiç
//   erişmez.
async function syncContentRuntime(req, res) {
  try {
    const { id } = req.params;
    const { tmdbId, mediaType, minutesPerEpisode } = req.body || {};

    if (mediaType !== "movie") {
      return res.status(400).json({
        ok: false,
        message: "Bu akış yalnızca film süresi tamamlama için kullanılabilir.",
      });
    }

    const numericTmdbId = Number(tmdbId);

    if (!Number.isInteger(numericTmdbId) || numericTmdbId <= 0) {
      return res.status(400).json({ ok: false, message: "Geçerli bir tmdbId gerekli." });
    }

    const normalizedMinutes = normalizeIncomingRuntimeMinutes(minutesPerEpisode);

    if (!normalizedMinutes) {
      return res.status(400).json({ ok: false, message: "Geçerli bir süre (dakika) gerekli." });
    }

    const content = await Content.findById(id);

    if (!content) {
      return res.status(404).json({ ok: false, message: "İçerik bulunamadı." });
    }

    if (content.mediaType !== "movie" || content.tmdbId !== numericTmdbId) {
      return res.status(400).json({ ok: false, message: "Eşleşme doğrulanamadı." });
    }

    if (Number(content.episodeDuration) > 0) {
      return res.json({ ok: true, data: content });
    }

    content.episodeDuration = normalizedMinutes;
    await content.save();

    res.json({ ok: true, data: content });
  } catch (error) {
    handleError(res, error, "Failed to sync content runtime");
  }
}

module.exports = {
  getContents,
  createContent,
  updateContent,
  deleteContent,
  bulkImportContents,
  syncContentRuntime,
};
