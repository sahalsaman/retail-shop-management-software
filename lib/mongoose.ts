import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not set in .env");
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  _mongoose?: MongooseCache;
};

const cache: MongooseCache =
  globalForMongoose._mongoose ?? { conn: null, promise: null };

if (!globalForMongoose._mongoose) {
  globalForMongoose._mongoose = cache;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI!, {
      bufferCommands: false,
      dbName: process.env.DB_NAME || undefined,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
