const { getDatabase } = require("../config/database");

function getConversationsCollection() {
  return getDatabase().collection("conversations");
}

async function createConversation(conversation) {
  const conversations = getConversationsCollection();

  return await conversations.insertOne(conversation);
}

async function findConversationByPairKey(pairKey) {
  const conversations = getConversationsCollection();

  return await conversations.findOne({ pairKey });
}

async function findConversationById(id) {
  const conversations = getConversationsCollection();

  return await conversations.findOne({ _id: id });
}

async function getUserConversations(userId) {
  const conversations = getConversationsCollection();

  return await conversations
    .find({
      members: userId,
    })
    .sort({ updatedAt: -1 })
    .toArray();
}

module.exports = {
  getConversationsCollection,
  createConversation,
  findConversationByPairKey,
  findConversationById,
  getUserConversations,
};