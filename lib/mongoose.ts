import mongoose from "mongoose";

// Cloud MongoDB. Used for:
//   1. login auth (verifying user credentials against the central DB)
//   2. background sync (push local writes / pull remote writes)
// May be missing or unreachable — callers must handle the "no cloud" case.

function getUri(): string | null {
  return process.env.CLOUD_MONGODB_URI || process.env.MONGODB_URI || null;
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { _mongoose?: MongooseCache };
const cache: MongooseCache = globalForMongoose._mongoose ?? { conn: null, promise: null };
if (!globalForMongoose._mongoose) globalForMongoose._mongoose = cache;

const CLOUD_TIMEOUT_MS = 5000;

export async function connectCloudDB(): Promise<typeof mongoose | null> {
  if (cache.conn) return cache.conn;
  const uri = getUri();
  if (!uri) return null;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        dbName: process.env.DB_NAME || undefined,
        serverSelectionTimeoutMS: CLOUD_TIMEOUT_MS,
        connectTimeoutMS: CLOUD_TIMEOUT_MS,
      })
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }
  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch {
    return null;
  }
}

// Back-compat alias for the modules that haven't been migrated to SQLite yet.
// They still call connectDB() — keep them working when the cloud is reachable.
export const connectDB = connectCloudDB as () => Promise<typeof mongoose>;
