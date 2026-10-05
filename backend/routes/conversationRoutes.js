const express = require("express");

const protect =
  require("../middleware/authMiddleware");

const protectConversation =
  require("../middleware/conversationMiddleware");

const {
  createOrGetConversation,
  getMyConversations,
  getConversation,
  markConversationAsDelivered,
  markConversationAsRead,
} =
  require("../controllers/conversationController");

const router =
  express.Router();


router.post(
  "/",
  protect,
  createOrGetConversation
);


router.get(
  "/",
  protect,
  getMyConversations
);


router.get(
  "/:conversationId",
  protect,
  protectConversation,
  getConversation
);


router.patch(
  "/:conversationId/delivered",
  protect,
  protectConversation,
  markConversationAsDelivered
);


router.patch(
  "/:conversationId/read",
  protect,
  protectConversation,
  markConversationAsRead
);


module.exports = router;