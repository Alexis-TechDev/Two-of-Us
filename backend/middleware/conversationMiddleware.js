const { ObjectId } = require("mongodb");

const {
  findConversationById,
} = require("../models/conversationModel");

async function protectConversation(
  req,
  res,
  next
) {
  try {
    const conversationId =
      req.params.conversationId ||
      req.body.conversationId;

    if (!conversationId) {
      return res.status(400).json({
        message: "Conversation ID is required.",
      });
    }

    if (!ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        message: "Invalid conversation ID.",
      });
    }

    const conversation =
      await findConversationById(
        new ObjectId(conversationId)
      );

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found.",
      });
    }

    const isMember =
      conversation.members.some(
        (member) =>
          member.toString() ===
          req.user.userId
      );

    if (!isMember) {
      return res.status(403).json({
        message:
          "You do not have access to this conversation.",
      });
    }

    req.conversation = conversation;

    next();
  } catch (error) {
    console.error(
      "Conversation access error:",
      error
    );

    res.status(500).json({
      message:
        "Unable to verify conversation access.",
    });
  }
}

module.exports = protectConversation;