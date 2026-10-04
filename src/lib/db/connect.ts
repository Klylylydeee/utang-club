import "server-only";
import mongoose from "mongoose";
import { getDatabaseEnv } from "@/lib/env";

// Reject unknown filter fields and strip query operators (e.g. `$ne`) from
// filter values, so untrusted input can never become a NoSQL operator.
mongoose.set("strictQuery", true);
mongoose.set("sanitizeFilter", true);

type ConnectionCache = {
  promise: Promise<typeof mongoose> | null;
};

// Survives dev hot reloads so we do not open a new pool on every edit.
const globalForMongoose = globalThis as typeof globalThis & {
  __utangClubMongoose?: ConnectionCache;
};

const cache: ConnectionCache = (globalForMongoose.__utangClubMongoose ??= { promise: null });

/** Returns the shared Mongoose connection, connecting on first use. */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!cache.promise) {
    const { MONGODB_URI } = getDatabaseEnv();
    cache.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5_000,
      })
      .catch((error: unknown) => {
        // Allow the next request to retry instead of caching the failure.
        cache.promise = null;
        throw error;
      });
  }
  return cache.promise;
}
