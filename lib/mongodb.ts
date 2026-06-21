import { MongoClient, type Db } from "mongodb";

const options = {};

let clientPromise: Promise<MongoClient>;

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

function getMongoClientPromise() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add it to .env.local.");
  }

  if (process.env.NODE_ENV === "development") {
    if (!globalForMongo._mongoClientPromise) {
      globalForMongo._mongoClientPromise = new MongoClient(uri, options).connect();
    }
    return globalForMongo._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(uri, options).connect();
  }

  return clientPromise;
}

let indexesReady = false;

export async function getDb(): Promise<Db> {
  const connectedClient = await getMongoClientPromise();
  const db = connectedClient.db(process.env.MONGODB_DB || "leetcode-tracker");

  if (!indexesReady) {
    await Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("progress").createIndex(
        { userId: 1, problemId: 1 },
        { unique: true }
      )
    ]);
    indexesReady = true;
  }

  return db;
}
