const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URI);

async function connectToMongoDB() {
  try {
    await client.connect();

    console.log("You successfully connected to MongoDB!");

    return client;
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error.message);

    throw error;
  }
}

async function disconnectFromMongoDB() {
  await client.close();
}

function getDatabase() {
  return client.db("twochat");
}

module.exports = {
  client,
  connectToMongoDB,
  disconnectFromMongoDB,
  getDatabase,
};