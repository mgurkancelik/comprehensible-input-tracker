const express = require("express");
const requireAuth = require("../middleware/authMiddleware");
const {
  getContents,
  createContent,
  updateContent,
  deleteContent,
  bulkImportContents,
} = require("../controllers/contentsController");

const router = express.Router();

// GET: guest browsing için public kalır (katalog okuma herkese açık).
router.get("/", getContents);

// Yazma işlemleri: en azından giriş yapılmış olmalı. createContent ayrıca
// controller seviyesinde alan whitelist'i uyguluyor; updateContent/
// deleteContent ise admin sistemi olmadığı için requireAuth'tan SONRA da
// controller içinde açıkça 403 döndürüyor (bkz. contentsController.js).
router.post("/", requireAuth, createContent);
router.post("/bulk-import", requireAuth, bulkImportContents);
router.put("/:id", requireAuth, updateContent);
router.delete("/:id", requireAuth, deleteContent);

module.exports = router;
