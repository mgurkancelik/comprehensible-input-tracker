const express = require("express");
const {
  getContents,
  createContent,
  updateContent,
  deleteContent,
  bulkImportContents,
} = require("../controllers/contentsController");

const router = express.Router();

router.get("/", getContents);
router.post("/", createContent);
router.post("/bulk-import", bulkImportContents);
router.put("/:id", updateContent);
router.delete("/:id", deleteContent);

module.exports = router;
