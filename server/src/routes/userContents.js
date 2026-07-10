const express = require("express");
const requireAuth = require("../middleware/authMiddleware");
const {
  getUserContents,
  createUserContent,
  updateUserContent,
  deleteUserContent,
} = require("../controllers/userContentsController");

const router = express.Router();

router.use(requireAuth);

router.get("/", getUserContents);
router.post("/", createUserContent);
router.put("/:id", updateUserContent);
router.delete("/:id", deleteUserContent);

module.exports = router;
