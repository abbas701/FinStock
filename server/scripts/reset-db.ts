
import "dotenv/config";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

async function resetDb() {
    const db = await getDb();
    if (!db) {
        console.error("No DB connection");
        process.exit(1);
    }

    console.log("Truncating tables...");
    try {
        await db.execute(sql`TRUNCATE TABLE "transactions", "watchlist", "stockAggregates", "users" RESTART IDENTITY CASCADE;`);
        console.log("Tables truncated.");
    } catch (e) {
        console.error("Error truncating:", e);
    }
    process.exit(0);
}

resetDb();
