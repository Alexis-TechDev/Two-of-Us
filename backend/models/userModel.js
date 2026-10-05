const { ObjectId } = require("mongodb");
const { getDatabase } = require("../config/database");

function getUsersCollection() {
  return getDatabase().collection("users");
}

async function createUser(user) {
  const users = getUsersCollection();

  return await users.insertOne(user);
}

async function findUserByEmail(email) {
  const users = getUsersCollection();

  return await users.findOne({ email });
}

async function findUserByPhone(phone) {
  const users = getUsersCollection();

  return await users.findOne({ phone });
}

async function findUserById(id) {
  const users = getUsersCollection();

  return await users.findOne({ _id: new ObjectId(id) });
}

async function updateUserById(id, updates) {
  const users = getUsersCollection();

  return await users.updateOne(
    { _id: new ObjectId(id) },
    { $set: updates }
  );
}

module.exports = {
  getUsersCollection,
  createUser,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  updateUserById,
};