import { connectToDatabase, disconnectDatabase } from "../db/connection.js";
import { env } from "../config/env.js";
import { syncAllIndexes } from "../models/index.js";
import { ensureDefaultHackathonAndDemoData } from "../services/demo-seed.service.js";

async function main() {
  console.log("[Seed] Connecting to database for demo seeding...");
  await connectToDatabase(env.MONGODB_URI);

  console.log("[Seed] Ensuring indexes...");
  await syncAllIndexes();

  console.log("[Seed] Ensuring default hackathon and demo squads...");
  const result = await ensureDefaultHackathonAndDemoData();

  console.log("[Seed] Done!");
  console.log(JSON.stringify(result, null, 2));

  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("[Seed] Failed:", err);
  try {
    await disconnectDatabase();
  } catch {
    // ignore
  }
  process.exit(1);
});
