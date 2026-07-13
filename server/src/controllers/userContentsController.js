const UserContent = require("../models/UserContent");
const User = require("../models/User");
const Content = require("../models/Content");

// error.message'ı olduğu gibi client'a döndürmüyoruz; sadece bilinen ve
// güvenli (secret içermeyen) hata tiplerinde mesajı geçiriyoruz, aksi halde
// genel bir mesaj dönüyoruz. Ayrıntı yalnızca sunucu logunda kalır.
function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage + ":", error.name, error.message);

  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ ok: false, message: error.message });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      ok: false,
      message: "Bu içerik zaten bu kullanıcının kütüphanesinde.",
    });
  }

  return res.status(500).json({ ok: false, message: fallbackMessage });
}

// Kullanıcının create/update body'sinde gönderebileceği güvenli alanlar.
// Bu listenin dışında kalan hiçbir alan (örn. userId, contentId'nin
// update'te değiştirilmesi) MongoDB'ye yazılmaz — client'ın kontrol
// etmemesi gereken alanlar whitelist dışı tutularak korunur.
const ALLOWED_USER_CONTENT_FIELDS = [
  "status",
  "watchedMinutes",
  "watchedPercentage",
  "watchedEpisodes",
  "totalEpisodes",
  "notes",
  "watchLogs",
  "seasons",
  "startDate",
  "finishDate",
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

// Domain için açıklanabilir bir üst sınır: bkz. UserContent.js şemasındaki
// totalEpisodes yorumu (en uzun soluklu dizi/animeleri kapsayacak kadar
// geniş, kötüye kullanımı reddedecek kadar dar).
const MAX_TOTAL_EPISODES = 100000;

// undefined/eksik alan bu fonksiyona hiç gelmez (pickAllowedFields zaten
// yalnızca body'de gerçekten bulunan alanları seçer) — bu yüzden mevcut
// değeri "değiştirmeme" davranışı whitelist seviyesinde garanti edilir.
// Burada yalnızca GELEN değerin geçerliliği kontrol edilir: geçersizse
// null döner ve controller 400 ile açıkça reddeder (sessiz normalize yok).
function normalizeTotalEpisodes(rawValue) {
  const numberValue = Number(rawValue);

  if (
    rawValue === null ||
    rawValue === "" ||
    !Number.isFinite(numberValue) ||
    !Number.isInteger(numberValue) ||
    numberValue < 0 ||
    numberValue > MAX_TOTAL_EPISODES
  ) {
    return null;
  }

  return numberValue;
}

async function getUserContents(req, res) {
  try {
    const userContents = await UserContent.find({ userId: req.userId })
      .populate("userId")
      .populate("contentId")
      .sort({ createdAt: -1 });

    res.json({ ok: true, count: userContents.length, data: userContents });
  } catch (error) {
    handleError(res, error, "Failed to fetch user contents");
  }
}

async function createUserContent(req, res) {
  try {
    const userId = req.userId;
    const { contentId } = req.body || {};

    if (!contentId) {
      return res
        .status(400)
        .json({ ok: false, message: "contentId zorunludur." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: "Kullanıcı bulunamadı." });
    }

    const content = await Content.findById(contentId);
    if (!content) {
      return res.status(404).json({ ok: false, message: "İçerik bulunamadı." });
    }

    const existing = await UserContent.findOne({ userId, contentId });
    if (existing) {
      return res.status(409).json({
        ok: false,
        message: "Bu içerik zaten bu kullanıcının kütüphanesinde.",
      });
    }

    const payload = pickAllowedFields(req.body, ALLOWED_USER_CONTENT_FIELDS);

    if (Object.prototype.hasOwnProperty.call(payload, "totalEpisodes")) {
      const normalized = normalizeTotalEpisodes(payload.totalEpisodes);

      if (normalized === null) {
        return res.status(400).json({
          ok: false,
          message: `totalEpisodes 0 ile ${MAX_TOTAL_EPISODES} arasında bir tam sayı olmalı.`,
        });
      }

      payload.totalEpisodes = normalized;
    }

    const created = await UserContent.create({ ...payload, userId, contentId });
    res.status(201).json({ ok: true, data: created });
  } catch (error) {
    handleError(res, error, "Failed to create user content");
  }
}

async function updateUserContent(req, res) {
  try {
    const { id } = req.params;
    const payload = pickAllowedFields(req.body, ALLOWED_USER_CONTENT_FIELDS);

    if (Object.prototype.hasOwnProperty.call(payload, "totalEpisodes")) {
      const normalized = normalizeTotalEpisodes(payload.totalEpisodes);

      if (normalized === null) {
        return res.status(400).json({
          ok: false,
          message: `totalEpisodes 0 ile ${MAX_TOTAL_EPISODES} arasında bir tam sayı olmalı.`,
        });
      }

      payload.totalEpisodes = normalized;
    }

    const updated = await UserContent.findOneAndUpdate(
      { _id: id, userId: req.userId },
      payload,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ ok: false, message: "Kayıt bulunamadı." });
    }

    res.json({ ok: true, data: updated });
  } catch (error) {
    handleError(res, error, "Failed to update user content");
  }
}

async function deleteUserContent(req, res) {
  try {
    const { id } = req.params;

    const deleted = await UserContent.findOneAndDelete({
      _id: id,
      userId: req.userId,
    });

    if (!deleted) {
      return res.status(404).json({ ok: false, message: "Kayıt bulunamadı." });
    }

    res.json({ ok: true, message: "Kayıt silindi." });
  } catch (error) {
    handleError(res, error, "Failed to delete user content");
  }
}

module.exports = {
  getUserContents,
  createUserContent,
  updateUserContent,
  deleteUserContent,
};
