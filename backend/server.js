const dotenv = require("dotenv");

dotenv.config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const {
  Server,
} = require("socket.io");
const {
  ObjectId,
} = require("mongodb");
const jwt = require("jsonwebtoken");

const authRoutes =
  require("./routes/authRoutes");

const messageRoutes =
  require("./routes/messageRoutes");

const conversationRoutes =
  require("./routes/conversationRoutes");

const {
  connectToMongoDB,
  getDatabase,
} =
  require("./config/database");


const app =
  express();

const allowedOrigins = (
  process.env.CLIENT_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  })
);


app.use(
  express.json({ limit: "9mb" })
);


app.use(
  "/api/auth",
  authRoutes
);


app.use(
  "/api/messages",
  messageRoutes
);


app.use(
  "/api/conversations",
  conversationRoutes
);


app.get(
  "/",
  (req, res) => {
    res.json({
      message:
        "TwoChat API is running",
    });
  }
);


const server =
  http.createServer(app);


const io =
  new Server(server, {
    cors: {
      origin: allowedOrigins,

      methods: [
        "GET",
        "POST",
        "PATCH",
      ],
    },
  });


io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = String(decoded.userId);
    next();
  } catch {
    next(new Error("Authentication required."));
  }
});


/*
 * userId -> socketId
 */
const onlineUsers =
  new Map();


/*
 * Mark every pending message for
 * a user as delivered when that
 * user comes online.
 */
async function markMessagesAsDelivered(
  userId
) {
  try {
    const messagesCollection =
      getDatabase()
        .collection("messages");


    const pendingMessages =
      await messagesCollection
        .find({
          senderId: {
            $ne: String(userId),
          },

          deliveredTo: {
            $ne: String(userId),
          },
        })
        .project({
          _id: 1,
          conversationId: 1,
          senderId: 1,
        })
        .toArray();


    if (
      pendingMessages.length ===
      0
    ) {
      return;
    }


    /*
     * Mark all of them as delivered.
     */
    const messageIds =
      pendingMessages.map(
        (message) =>
          message._id
      );


    await messagesCollection
      .updateMany(
        {
          _id: {
            $in: messageIds,
          },
        },

        {
          $addToSet: {
            deliveredTo:
              String(userId),
          },
        }
      );


    /*
     * Group messages by sender
     * and conversation.
     */
    const groupedMessages =
      new Map();


    for (
      const message of
      pendingMessages
    ) {
      const conversationId =
        message.conversationId.toString();

      const senderId =
        message.senderId.toString();


      const key =
        `${senderId}:${conversationId}`;


      if (
        !groupedMessages.has(key)
      ) {
        groupedMessages.set(
          key,
          {
            conversationId,
            senderId,
            messageIds: [],
          }
        );
      }


      groupedMessages
        .get(key)
        .messageIds
        .push(
          message._id.toString()
        );
    }


    /*
     * Tell each sender that their
     * messages have been delivered.
     */
    for (
      const group of
      groupedMessages.values()
    ) {
      const senderSocketId =
        onlineUsers.get(
          group.senderId
        );


      if (
        !senderSocketId
      ) {
        continue;
      }


      io.to(
        senderSocketId
      ).emit(
        "messageStatusUpdated",
        {
          status:
            "delivered",

          conversationId:
            group.conversationId,

          messageIds:
            group.messageIds,

          userId:
            String(userId),
        }
      );
    }

  } catch (error) {

    console.error(
      "Mark messages delivered error:",
      error
    );
  }
}


io.on(
  "connection",
  (socket) => {

    console.log(
      "User connected:",
      socket.id
    );


    async function relayCallSignal(eventName, payload, signalField) {
      try {
        const conversationId = payload?.conversationId;

        if (!ObjectId.isValid(conversationId) || !socket.userId) {
          return;
        }

        const conversation = await getDatabase()
          .collection("conversations")
          .findOne({ _id: new ObjectId(conversationId) });

        const memberIds = conversation?.members.map((member) => member.toString()) || [];
        const recipientId = memberIds.find((memberId) => memberId !== socket.userId);

        if (!recipientId || !memberIds.includes(socket.userId)) {
          return;
        }

        const recipientSocketId = onlineUsers.get(recipientId);

        if (recipientSocketId) {
          io.to(recipientSocketId).emit(eventName, {
            conversationId,
            fromUserId: socket.userId,
            [signalField]: payload[signalField],
          });
        }
      } catch (error) {
        console.error("Call signaling error:", error);
      }
    }


    socket.on("callOffer", (payload) => {
      relayCallSignal("callIncoming", payload, "offer");
    });

    socket.on("callAnswer", (payload) => {
      relayCallSignal("callAnswered", payload, "answer");
    });

    socket.on("callIceCandidate", (payload) => {
      relayCallSignal("callIceCandidate", payload, "candidate");
    });

    socket.on("callEnd", (payload) => {
      relayCallSignal("callEnded", payload, "reason");
    });


    /*
     * USER ONLINE
     */
    socket.on(
      "userOnline",
      async (userId) => {

        const cleanUserId =
          String(userId);

        if (cleanUserId !== socket.userId) {
          return;
        }


        socket.userId =
          cleanUserId;


        onlineUsers.set(
          cleanUserId,
          socket.id
        );


        console.log(
          `User ${cleanUserId} is online`
        );


        /*
         * IMPORTANT:
         *
         * As soon as the receiver
         * comes online, mark their
         * pending messages as
         * delivered.
         *
         * This sends the BLUE ✓✓
         * event to the sender.
         */
        await markMessagesAsDelivered(
          cleanUserId
        );


        socket.broadcast.emit(
          "userStatus",
          {
            userId:
              cleanUserId,

            online:
              true,
          }
        );
      }
    );


    /*
     * JOIN CONVERSATION
     */
    socket.on(
      "joinConversation",
      async (conversationId) => {

        if (!ObjectId.isValid(conversationId) || !socket.userId) {
          return;
        }

        const conversation = await getDatabase()
          .collection("conversations")
          .findOne({ _id: new ObjectId(conversationId) });

        if (!conversation?.members.some((member) => member.toString() === socket.userId)) {
          return;
        }

        socket.join(
          conversationId
        );


        console.log(
          `Socket ${socket.id} joined conversation ${conversationId}`
        );


        const usersInConversation =
          [];


        for (
          const [
            userId,
            socketId,
          ] of onlineUsers.entries()
        ) {

          const userSocket =
            io.sockets.sockets.get(
              socketId
            );


          if (
            userSocket &&
            userSocket.rooms.has(
              conversationId
            )
          ) {
            usersInConversation.push(
              userId
            );
          }
        }


        socket.emit(
          "conversationUsers",
          usersInConversation
        );
      }
    );


    /*
     * TYPING
     */
    socket.on(
      "typing",
      ({
        conversationId,
        userId,
      }) => {

        socket
          .to(conversationId)
          .emit(
            "userTyping",
            {
              userId,
            }
          );
      }
    );


    /*
     * STOP TYPING
     */
    socket.on(
      "stopTyping",
      ({
        conversationId,
        userId,
      }) => {

        socket
          .to(conversationId)
          .emit(
            "userStoppedTyping",
            {
              userId,
            }
          );
      }
    );


    /*
     * SEND MESSAGE
     */
    socket.on(
      "sendMessage",
      async (message) => {

        try {

          if (
            !message?.id ||
            !message?.conversationId ||
            !message?.senderId
          ) {
            return;
          }


          if (
            !ObjectId.isValid(
              message.conversationId
            )
          ) {
            return;
          }


          if (
            !ObjectId.isValid(
              message.id
            )
          ) {
            return;
          }


          const conversation =
            await getDatabase()
              .collection(
                "conversations"
              )
              .findOne({
                _id:
                  new ObjectId(
                    message.conversationId
                  ),
              });


          if (
            !conversation ||
            String(message.senderId) !== socket.userId ||
            !conversation.members.some((member) => member.toString() === socket.userId)
          ) {
            return;
          }


          /*
           * Find the other person.
           */
          const recipientId =
            conversation.members
              .map(
                (member) =>
                  member.toString()
              )
              .find(
                (userId) =>
                  userId !==
                  String(
                    message.senderId
                  )
              );


          if (!recipientId) {
            return;
          }


          /*
           * Check if the receiver
           * is currently online.
           */
          const recipientSocketId =
            onlineUsers.get(
              recipientId
            );


          /*
           * If receiver is online,
           * immediately mark the
           * message as delivered.
           */
          if (
            recipientSocketId
          ) {

            await getDatabase()
              .collection(
                "messages"
              )
              .updateOne(
                {
                  _id:
                    new ObjectId(
                      message.id
                    ),
                },

                {
                  $addToSet: {
                    deliveredTo:
                      recipientId,
                  },
                }
              );
          }


          /*
           * Get the latest message
           * from MongoDB.
           */
          const savedMessage =
            await getDatabase()
              .collection(
                "messages"
              )
              .findOne({
                _id:
                  new ObjectId(
                    message.id
                  ),
              });


          if (!savedMessage) {
            return;
          }


          const updatedMessage = {
            id:
              savedMessage._id.toString(),

            conversationId:
              savedMessage.conversationId.toString(),

            senderId:
              savedMessage.senderId,

            text:
              savedMessage.text,

            attachment:
              savedMessage.attachment || null,

            deliveredTo:
              savedMessage.deliveredTo ||
              [],

            readBy:
              savedMessage.readBy ||
              [],

            createdAt:
              savedMessage.createdAt,
          };


          /*
           * Send the message to everyone
           * currently inside the chat.
           */
          io.to(
            message.conversationId
          ).emit(
            "newMessage",
            updatedMessage
          );


          /*
           * Update conversation list
           * for every online member.
           */
          for (
            const memberId of
            conversation.members
          ) {

            const userId =
              memberId.toString();


            const socketId =
              onlineUsers.get(
                userId
              );


            if (!socketId) {
              continue;
            }


            const isSender =
              userId ===
              String(
                message.senderId
              );


            io.to(socketId).emit(
              "conversationUpdated",
              {
                conversationId:
                  message.conversationId,

                message:
                  updatedMessage,

                unread:
                  !isSender,
              }
            );
          }

        } catch (error) {

          console.error(
            "Socket send message error:",
            error
          );
        }
      }
    );


    /*
     * MESSAGES READ
     */
    socket.on(
      "messagesRead",
      async ({
        conversationId,
        userId,
      }) => {

        try {

          if (
            !ObjectId.isValid(
              conversationId
            )
          ) {
            return;
          }


          const cleanUserId =
            String(userId);


          const result =
            await getDatabase()
              .collection(
                "messages"
              )
              .updateMany(
                {
                  conversationId:
                    new ObjectId(
                      conversationId
                    ),

                  senderId: {
                    $ne:
                      cleanUserId,
                  },

                  readBy: {
                    $ne:
                      cleanUserId,
                  },
                },

                {
                  $addToSet: {
                    deliveredTo:
                      cleanUserId,

                    readBy:
                      cleanUserId,
                  },
                }
              );


          /*
           * Tell the sender that
           * their messages are now read.
           *
           * The Chat.jsx listener will
           * turn BLUE into GREEN.
           */
          socket
            .to(conversationId)
            .emit(
              "messageStatusUpdated",
              {
                status:
                  "read",

                conversationId,

                userId:
                  cleanUserId,

                modifiedCount:
                  result.modifiedCount,
              }
            );


          /*
           * Keep the old event too.
           */
          socket
            .to(conversationId)
            .emit(
              "messagesRead",
              {
                conversationId,

                userId:
                  cleanUserId,

                modifiedCount:
                  result.modifiedCount,
              }
            );

        } catch (error) {

          console.error(
            "Messages read socket error:",
            error
          );
        }
      }
    );


    /*
     * DISCONNECT
     */
    socket.on(
      "disconnect",
      () => {

        if (
          socket.userId
        ) {

          /*
           * Only remove the user if
           * this is still their active
           * socket.
           */
          if (
            onlineUsers.get(
              socket.userId
            ) ===
            socket.id
          ) {

            onlineUsers.delete(
              socket.userId
            );


            socket.broadcast.emit(
              "userStatus",
              {
                userId:
                  socket.userId,

                online:
                  false,
              }
            );


            console.log(
              `User ${socket.userId} is offline`
            );
          }
        }


        console.log(
          "User disconnected:",
          socket.id
        );
      }
    );
  }
);


const PORT =
  process.env.PORT || 5000;


async function startServer() {

  try {

    await connectToMongoDB();


    const usersCollection = getDatabase().collection("users");
    const userIndexes = await usersCollection.indexes();
    const oldEmailIndex = userIndexes.find(
      (index) => index.key.email === 1 && index.unique && !index.sparse
    );

    if (oldEmailIndex) {
      await usersCollection.dropIndex(oldEmailIndex.name);
    }

    await usersCollection.updateMany(
      { email: "" },
      { $unset: { email: "" } }
    );

    await usersCollection.createIndex(
      { email: 1 },
      { unique: true, sparse: true }
    );

    await usersCollection.createIndex(
      { phone: 1 },
      { unique: true, sparse: true }
    );


    await getDatabase()
      .collection("messages")
      .createIndex({
        conversationId: 1,
        createdAt: 1,
      });


    await getDatabase()
      .collection(
        "conversations"
      )
      .createIndex(
        {
          pairKey: 1,
        },
        {
          unique: true,
        }
      );


    console.log(
      "Users collection is ready."
    );


    console.log(
      "Messages collection is ready."
    );


    console.log(
      "Conversations collection is ready."
    );


    server.listen(
      PORT,
      () => {
        console.log(
          `Server running on port ${PORT}`
        );
      }
    );

  } catch (error) {

    console.error(
      "Unable to start server."
    );

    console.error(
      error.message
    );
  }
}


startServer();