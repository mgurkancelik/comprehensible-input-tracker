const jwt = require("jsonwebtoken");

// userContents gibi kullanıcıya özel route'ları korur. Doğrulanmış kullanıcı
// kimliğini req.userId'ye yazar; controller'lar artık client'ın gönderdiği
// query/body userId'sine değil, sadece bu değere güvenmeli.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, message: "Token bulunamadı." });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({ ok: false, message: "Token bulunamadı." });
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error("JWT_SECRET missing");
    return res.status(500).json({
      ok: false,
      message: "Sunucu yapılandırma hatası: JWT_SECRET eksik.",
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.userId;
    next();
  } catch {
    return res
      .status(401)
      .json({ ok: false, message: "Token geçersiz veya süresi dolmuş." });
  }
}

module.exports = requireAuth;
