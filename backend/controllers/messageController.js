const { ObjectId } = require("mongodb");

const {
  createMessage,
  getConversationMessages,
} = require("../models/messageModel");


async function sendMessage(req, res) {
  try {
    const { conversationId, text, attachment } = req.body;

    if (!conversationId || (!text?.trim() && !attachment)) {
      return res.status(400).json({
        message:
          "A conversation and message or attachment are required.",
      });
    }

    if (
      !ObjectId.isValid(
        conversationId
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid conversation ID.",
      });
    }

    const cleanText = typeof text === "string" ? text.trim() : "";

    if (!cleanText && !attachment) {
      return res.status(400).json({
        message: "Message cannot be empty.",
      });
    }

    if (
      attachment &&
      (typeof attachment.name !== "string" ||
        typeof attachment.type !== "string" ||
        typeof attachment.data !== "string" ||
        !attachment.data.startsWith(`data:${attachment.type};base64,`) ||
        attachment.data.length > 7 * 1024 * 1024)
    ) {
      return res.status(400).json({
        message: "Attachments must be smaller than 5 MB.",
      });
    }

    /*
     * The sender has sent the message,
     * so the sender is included in both
     * deliveredTo and readBy.
     *
     * The receiver is NOT included yet.
     */
    const message = {
      conversationId:
        new ObjectId(
          conversationId
        ),

      senderId:
        req.user.userId,

      text:
        cleanText,

      attachment: attachment
        ? {
            name: attachment.name.slice(0, 255),
            type: attachment.type.slice(0, 120),
            data: attachment.data,
            size: Number(attachment.size) || 0,
          }
        : null,

      deliveredTo: [
        req.user.userId,
      ],

      readBy: [
        req.user.userId,
      ],

      createdAt:
        new Date(),
    };

    const result =
      await createMessage(
        message
      );

    res.status(201).json({
      message: {
        id:
          result.insertedId.toString(),

        conversationId,

        senderId:
          message.senderId,

        text:
          message.text,

        attachment: message.attachment,

        deliveredTo:
          message.deliveredTo,

        readBy:
          message.readBy,

        createdAt:
          message.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Send message error:",
      error
    );

    res.status(500).json({
      message:
        "Unable to send message.",
    });
  }
}


async function getMessages(req, res) {
  try {
    const {
      conversationId,
    } = req.params;

    if (
      !ObjectId.isValid(
        conversationId
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid conversation ID.",
      });
    }

    const messages =
      await getConversationMessages(
        conversationId
      );

    const result =
      messages.map(
        (message) => ({
          id:
            message._id.toString(),

          conversationId:
            message.conversationId.toString(),

          senderId:
            message.senderId,

          text:
            message.text,

          attachment: message.attachment || null,

          deliveredTo:
            message.deliveredTo ||
            [],

          readBy:
            message.readBy ||
            [],

          createdAt:
            message.createdAt,
        })
      );

    res.status(200).json({
      messages:
        result,
    });
  } catch (error) {
    console.error(
      "Get messages error:",
      error
    );

    res.status(500).json({
      message:
        "Unable to load messages.",
    });
  }
}


module.exports = {
  sendMessage,
  getMessages,
};