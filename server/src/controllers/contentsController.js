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

module.exports = {
  getContents,
  createContent,
  updateContent,
  deleteContent,
  bulkImportContents,
};
