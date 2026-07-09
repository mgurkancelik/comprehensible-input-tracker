const User = require("../models/User");

// error.message'ı olduğu gibi client'a döndürmüyoruz; sadece bilinen ve
// güvenli (secret içermeyen) hata tiplerinde mesajı geçiriyoruz, aksi halde
// genel bir mesaj dönüyoruz. Ayrıntı yalnızca sunucu logunda kalır.
function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage + ":", error.name, error.message);

  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ ok: false, message: error.message });
  }

  if (error.code === 11000) {
    return res
      .status(409)
      .json({ ok: false, message: "Bu email zaten kayıtlı." });
  }

  return res.status(500).json({ ok: false, message: fallbackMessage });
}

async function getUsers(req, res) {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ ok: true, count: users.length, data: users });
  } catch (error) {
    handleError(res, error, "Failed to fetch users");
  }
}

async function createUser(req, res) {
  try {
    const { name, email } = req.body;
    const created = await User.create({ name, email });
    res.status(201).json({ ok: true, data: created });
  } catch (error) {
    handleError(res, error, "Failed to create user");
  }
}

module.exports = {
  getUsers,
  createUser,
};
