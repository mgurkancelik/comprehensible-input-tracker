const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const SALT_ROUNDS = 10;
const TOKEN_EXPIRES_IN = "7d";

// JWT_SECRET .env dosyasından okunur, kod içine asla yazılmaz. Eksikse
// endpoint'ler DB'ye hiç dokunmadan, anlaşılır bir 500 mesajıyla erken döner.
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET tanımlı değil.");
  }

  return secret;
}

function toSafeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// error.message'ı olduğu gibi client'a döndürmüyoruz; sadece bilinen ve
// güvenli (secret içermeyen) hata tiplerinde mesajı geçiriyoruz, aksi halde
// genel bir mesaj dönüyoruz. Ayrıntı yalnızca sunucu logunda kalır.
function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage + ":", error.name, error.message);

  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ ok: false, message: error.message });
  }

  if (error.code === 11000) {
    return res.status(409).json({ ok: false, message: "Bu email zaten kayıtlı." });
  }

  return res.status(500).json({ ok: false, message: fallbackMessage });
}

async function register(req, res) {
  let jwtSecret;

  try {
    jwtSecret = getJwtSecret();
  } catch (error) {
    console.error("JWT_SECRET missing:", error.message);
    return res.status(500).json({
      ok: false,
      message: "Sunucu yapılandırma hatası: JWT_SECRET eksik.",
    });
  }

  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim() || !email || !email.trim() || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "name, email ve password zorunludur." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ ok: false, message: "password en az 6 karakter olmalı." });
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase() });

    if (existing) {
      return res.status(409).json({ ok: false, message: "Bu email zaten kayıtlı." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ name, email, passwordHash });

    const token = jwt.sign({ userId: user._id.toString() }, jwtSecret, {
      expiresIn: TOKEN_EXPIRES_IN,
    });

    res.status(201).json({ ok: true, token, user: toSafeUser(user) });
  } catch (error) {
    handleError(res, error, "Failed to register");
  }
}

async function login(req, res) {
  let jwtSecret;

  try {
    jwtSecret = getJwtSecret();
  } catch (error) {
    console.error("JWT_SECRET missing:", error.message);
    return res.status(500).json({
      ok: false,
      message: "Sunucu yapılandırma hatası: JWT_SECRET eksik.",
    });
  }

  try {
    const { email, password } = req.body;

    if (!email || !email.trim() || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "email ve password zorunludur." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
      "+passwordHash"
    );

    if (!user) {
      return res.status(401).json({ ok: false, message: "Email veya şifre hatalı." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ ok: false, message: "Email veya şifre hatalı." });
    }

    const token = jwt.sign({ userId: user._id.toString() }, jwtSecret, {
      expiresIn: TOKEN_EXPIRES_IN,
    });

    res.json({ ok: true, token, user: toSafeUser(user) });
  } catch (error) {
    handleError(res, error, "Failed to login");
  }
}

async function me(req, res) {
  let jwtSecret;

  try {
    jwtSecret = getJwtSecret();
  } catch (error) {
    console.error("JWT_SECRET missing:", error.message);
    return res.status(500).json({
      ok: false,
      message: "Sunucu yapılandırma hatası: JWT_SECRET eksik.",
    });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ ok: false, message: "Token bulunamadı." });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      return res
        .status(401)
        .json({ ok: false, message: "Token geçersiz veya süresi dolmuş." });
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ ok: false, message: "Kullanıcı bulunamadı." });
    }

    res.json({ ok: true, user: toSafeUser(user) });
  } catch (error) {
    handleError(res, error, "Failed to fetch current user");
  }
}

module.exports = { register, login, me };
