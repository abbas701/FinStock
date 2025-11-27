import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log("[Migrations] DATABASE_URL not set, skipping migrations");
    return;
  }

  try {
    const client = postgres(process.env.DATABASE_URL);
    const sqlFile = readFileSync(join(process.cwd(), "drizzle/0000_medical_goblin_queen.sql"), "utf-8");
    
    // Split by statement breakpoint and execute each statement
    const statements = sqlFile
      .split("--> statement-breakpoint")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      if (statement.trim()) {
        await client.unsafe(statement);
      }
    }

    await client.end();
    console.log("[Migrations] Database tables created/verified");
  } catch (error: any) {
    // Ignore "already exists" errors
    if (error?.message?.includes("already exists") || error?.code === "42P07") {
      console.log("[Migrations] Tables already exist, skipping");
    } else {
      console.error("[Migrations] Error running migrations:", error.message);
    }
  }
}

