const express = require("express");
const {
  getUserContents,
  createUserContent,
  updateUserContent,
  deleteUserContent,
} = require("../controllers/userContentsController");

const router = express.Router();

router.get("/", getUserContents);
router.post("/", createUserContent);
router.put("/:id", updateUserContent);
router.delete("/:id", deleteUserContent);

module.exports = router;
