import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

/** MongoDB ships no Windows ARM build; Windows 11 on ARM runs the x64 one under emulation. */
function binaryOptions() {
  return process.platform === "win32" && process.arch === "arm64" ? { arch: "x64" } : {};
}

/**
 * Starts an in-memory MongoDB for one test file and points the app's
 * connection at it. Call the returned `stop` in afterAll.
 */
export async function startTestDatabase(name: string) {
  const server = await MongoMemoryServer.create({ binary: binaryOptions() });
  process.env.MONGODB_URI = server.getUri(name);
  resetConnectionCache();
  const { connectToDatabase } = await import("@/lib/db/connect");
  await connectToDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));

  return {
    /** Removes every document, keeping indexes. */
    async clear() {
      await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
    },
    async stop() {
      await mongoose.disconnect();
      resetConnectionCache();
      await server.stop();
    },
  };
}

/** The app caches its connection on globalThis (hot-reload safety); tests reset it. */
function resetConnectionCache() {
  delete (globalThis as { __utangClubMongoose?: unknown }).__utangClubMongoose;
}
