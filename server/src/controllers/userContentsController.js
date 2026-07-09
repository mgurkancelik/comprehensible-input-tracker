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

async function getUserContents(req, res) {
  try {
    const { userId } = req.query;
    const filter = userId ? { userId } : {};

    const userContents = await UserContent.find(filter)
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
    const { userId, contentId } = req.body;

    if (!userId || !contentId) {
      return res
        .status(400)
        .json({ ok: false, message: "userId ve contentId zorunludur." });
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

    const created = await UserContent.create(req.body);
    res.status(201).json({ ok: true, data: created });
  } catch (error) {
    handleError(res, error, "Failed to create user content");
  }
}

async function updateUserContent(req, res) {
  try {
    const { id } = req.params;

    const updated = await UserContent.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

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

    const deleted = await UserContent.findByIdAndDelete(id);

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
