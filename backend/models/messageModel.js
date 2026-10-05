const { ObjectId } = require("mongodb");

const {
  getDatabase,
} = require("../config/database");

function getMessagesCollection() {
  return getDatabase().collection("messages");
}

async function createMessage(message) {
  const messages = getMessagesCollection();

  return await messages.insertOne(message);
}

async function getConversationMessages(
  conversationId
) {
  const messages = getMessagesCollection();

  return await messages
    .find({
      conversationId: new ObjectId(
        conversationId
      ),
    })
    .sort({ createdAt: 1 })
    .toArray();
}

module.exports = {
  getMessagesCollection,
  createMessage,
  getConversationMessages,
};