import mongoose from "mongoose";

const globalForMongoose = global as typeof globalThis & {
  mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

if (!globalForMongoose.mongoose) {
  globalForMongoose.mongoose = {
    conn: null,
    promise: null,
  };
}

async function connectToDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Please add DATABASE_URL to your environment variables");
  }

  if (globalForMongoose.mongoose.conn) {
    console.log("MongoDB: using existing connection");
    return globalForMongoose.mongoose.conn;
  }

  if (!globalForMongoose.mongoose.promise) {
    globalForMongoose.mongoose.promise = mongoose.connect(databaseUrl, {
      bufferCommands: false,
    });
  }

  try {
    globalForMongoose.mongoose.conn = await globalForMongoose.mongoose.promise;
    console.log("MongoDB: connected successfully");
  } catch (error) {
    globalForMongoose.mongoose.promise = null;
    console.error("MongoDB connection error:", error);
    throw new Error("Failed to connect to MongoDB");
  }

  return globalForMongoose.mongoose.conn;
}

export default connectToDatabase;
