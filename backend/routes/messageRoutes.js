const express = require("express");

const protect = require("../middleware/authMiddleware");

const protectConversation = require(
  "../middleware/conversationMiddleware"
);

const {
  sendMessage,
  getMessages,
} = require("../controllers/messageController");

const router = express.Router();

router.post(
  "/",
  protect,
  protectConversation,
  sendMessage
);

router.get(
  "/:conversationId",
  protect,
  protectConversation,
  getMessages
);

module.exports = router;