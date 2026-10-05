const { ObjectId } = require("mongodb");

const {
  createConversation,
  findConversationByPairKey,
  findConversationById,
  getUserConversations,
} = require("../models/conversationModel");

const {
  findUserByPhone,
} = require("../models/userModel");

const {
  getDatabase,
} = require("../config/database");


async function getConversationUsers(
  memberIds
) {
  const users =
    await getDatabase()
      .collection("users")
      .find({
        _id: {
          $in: memberIds,
        },
      })
      .project({
        name: 1,
        email: 1,
        phone: 1,
        profilePicture: 1,
      })
      .toArray();

  return users.map(
    (user) => ({
      id:
        user._id.toString(),

      name:
        user.name || "",

      email:
        user.email || "",

      phone:
        user.phone || "",

      profilePicture:
        user.profilePicture || "",
    })
  );
}


async function getLastMessage(
  conversationId
) {
  const message =
    await getDatabase()
      .collection("messages")
      .findOne(
        {
          conversationId,
        },
        {
          sort: {
            createdAt: -1,
          },
        }
      );

  if (!message) {
    return null;
  }

  return {
    id:
      message._id.toString(),

    text:
      message.text || (message.attachment ? "Attachment" : ""),

    attachment: message.attachment
      ? {
          name: message.attachment.name,
          type: message.attachment.type,
        }
      : null,

    senderId:
      message.senderId,

    deliveredTo:
      message.deliveredTo || [],

    readBy:
      message.readBy || [],

    createdAt:
      message.createdAt,
  };
}


async function getUnreadCount(
  conversationId,
  userId
) {
  return await getDatabase()
    .collection("messages")
    .countDocuments({
      conversationId:
        new ObjectId(
          conversationId
        ),

      senderId: {
        $ne: userId,
      },

      readBy: {
        $ne: userId,
      },
    });
}


async function createOrGetConversation(
  req,
  res
) {
  try {
    const {
      partnerPhone,
    } = req.body;

    if (!partnerPhone) {
      return res.status(400).json({
        message: "Partner phone number is required.",
      });
    }

    const cleanPhone = partnerPhone.replace(/[^\d+]/g, "");

    const currentUserId =
      new ObjectId(
        req.user.userId
      );

    const partner = await findUserByPhone(cleanPhone);

    if (!partner) {
      return res.status(404).json({
        message:
          "No account was found with that phone number.",
      });
    }

    if (
      partner._id.toString() ===
      currentUserId.toString()
    ) {
      return res.status(400).json({
        message:
          "You cannot connect with yourself.",
      });
    }

    const partnerId =
      partner._id;

    const pairKey = [
      currentUserId.toString(),
      partnerId.toString(),
    ]
      .sort()
      .join(":");

    const existingConversation =
      await findConversationByPairKey(
        pairKey
      );

    if (existingConversation) {
      const users =
        await getConversationUsers(
          existingConversation.members
        );

      const lastMessage =
        await getLastMessage(
          existingConversation._id
        );

      const unreadCount =
        await getUnreadCount(
          existingConversation._id,
          req.user.userId
        );

      return res.status(200).json({
        message:
          "Conversation already exists.",

        conversation: {
          id:
            existingConversation._id.toString(),

          members:
            existingConversation.members.map(
              (member) =>
                member.toString()
            ),

          users,

          lastMessage,

          unreadCount,

          createdAt:
            existingConversation.createdAt,

          updatedAt:
            existingConversation.updatedAt,
        },
      });
    }

    const conversation = {
      pairKey,

      members: [
        currentUserId,
        partnerId,
      ],

      createdAt:
        new Date(),

      updatedAt:
        new Date(),
    };

    const result =
      await createConversation(
        conversation
      );

    const users =
      await getConversationUsers([
        currentUserId,
        partnerId,
      ]);

    res.status(201).json({
      message:
        "Conversation created successfully.",

      conversation: {
        id:
          result.insertedId.toString(),

        members: [
          currentUserId.toString(),
          partnerId.toString(),
        ],

        users,

        lastMessage: null,

        unreadCount: 0,

        createdAt:
          conversation.createdAt,

        updatedAt:
          conversation.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Create conversation error:",
      error
    );

    res.status(500).json({
      message:
        "Unable to create conversation.",
    });
  }
}


async function getMyConversations(
  req,
  res
) {
  try {
    const userId =
      new ObjectId(
        req.user.userId
      );

    const conversations =
      await getUserConversations(
        userId
      );

    const result =
      await Promise.all(
        conversations.map(
          async (
            conversation
          ) => {
            const users =
              await getConversationUsers(
                conversation.members
              );

            const lastMessage =
              await getLastMessage(
                conversation._id
              );

            const unreadCount =
              await getUnreadCount(
                conversation._id,
                req.user.userId
              );

            return {
              id:
                conversation._id.toString(),

              members:
                conversation.members.map(
                  (member) =>
                    member.toString()
                ),

              users,

              lastMessage,

              unreadCount,

              createdAt:
                conversation.createdAt,

              updatedAt:
                conversation.updatedAt,
            };
          }
        )
      );

    res.status(200).json({
      conversations:
        result,
    });
  } catch (error) {
    console.error(
      "Get conversations error:",
      error
    );

    res.status(500).json({
      message:
        "Unable to load conversations.",
    });
  }
}


async function getConversation(
  req,
  res
) {
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

    const conversation =
      await findConversationById(
        new ObjectId(
          conversationId
        )
      );

    if (!conversation) {
      return res.status(404).json({
        message:
          "Conversation not found.",
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

    const users =
      await getConversationUsers(
        conversation.members
      );

    const lastMessage =
      await getLastMessage(
        conversation._id
      );

    const unreadCount =
      await getUnreadCount(
        conversation._id,
        req.user.userId
      );

    res.status(200).json({
      conversation: {
        id:
          conversation._id.toString(),

        members:
          conversation.members.map(
            (member) =>
              member.toString()
          ),

        users,

        lastMessage,

        unreadCount,

        createdAt:
          conversation.createdAt,

        updatedAt:
          conversation.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Get conversation error:",
      error
    );

    res.status(500).json({
      message:
        "Unable to load conversation.",
    });
  }
}


/*
 * Mark messages as delivered.
 *
 * This is useful when the receiver's
 * application is connected and receives
 * the message.
 */
async function markConversationAsDelivered(
  req,
  res
) {
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

    const userId =
      req.user.userId;

    const result =
      await getDatabase()
        .collection("messages")
        .updateMany(
          {
            conversationId:
              new ObjectId(
                conversationId
              ),

            senderId: {
              $ne: userId,
            },

            deliveredTo: {
              $ne: userId,
            },
          },

          {
            $addToSet: {
              deliveredTo:
                userId,
            },
          }
        );

    res.status(200).json({
      message:
        "Messages marked as delivered.",

      modifiedCount:
        result.modifiedCount,
    });
  } catch (error) {
    console.error(
      "Mark messages as delivered error:",
      error
    );

    res.status(500).json({
      message:
        "Unable to mark messages as delivered.",
    });
  }
}


/*
 * Mark messages as read.
 *
 * Opening the conversation marks
 * messages from the other person
 * as both delivered and read.
 */
async function markConversationAsRead(
  req,
  res
) {
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

    const userId =
      req.user.userId;

    const result =
      await getDatabase()
        .collection("messages")
        .updateMany(
          {
            conversationId:
              new ObjectId(
                conversationId
              ),

            senderId: {
              $ne: userId,
            },

            readBy: {
              $ne: userId,
            },
          },

          {
            $addToSet: {
              deliveredTo:
                userId,

              readBy:
                userId,
            },
          }
        );

    res.status(200).json({
      message:
        "Messages marked as read.",

      modifiedCount:
        result.modifiedCount,
    });
  } catch (error) {
    console.error(
      "Mark messages as read error:",
      error
    );

    res.status(500).json({
      message:
        "Unable to mark messages as read.",
    });
  }
}


module.exports = {
  createOrGetConversation,
  getMyConversations,
  getConversation,
  markConversationAsDelivered,
  markConversationAsRead,
};