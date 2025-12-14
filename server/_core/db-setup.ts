import postgres from "postgres";

/**
 * Ensure all required database tables exist, create them if they don't
 */
export async function ensureTablesExist() {
  if (!process.env.DATABASE_URL) {
    console.log("[DB Setup] DATABASE_URL not set, skipping table creation");
    return;
  }

  const client = postgres(process.env.DATABASE_URL);

  try {
    // Create ENUM types if they don't exist
    await client.unsafe(`
      DO $$ BEGIN
        CREATE TYPE "public"."role" AS ENUM('user', 'admin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.unsafe(`
      DO $$ BEGIN
        CREATE TYPE "public"."transaction_type" AS ENUM('BUY', 'SELL', 'DIVIDEND');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create tables if they don't exist
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "stocks" (
        "id" serial PRIMARY KEY NOT NULL,
        "symbol" varchar(10) NOT NULL,
        "name" varchar(255) NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "stocks_symbol_unique" UNIQUE("symbol")
      );
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" serial PRIMARY KEY NOT NULL,
        "stockId" integer NOT NULL,
        "type" "transaction_type" NOT NULL,
        "date" date NOT NULL,
        "quantity" numeric(18, 8),
        "totalAmount" numeric(18, 2) NOT NULL,
        "unitPrice" numeric(18, 8),
        "notes" text,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "stockAggregates" (
        "id" serial PRIMARY KEY NOT NULL,
        "stockId" integer NOT NULL,
        "totalShares" numeric(18, 8) DEFAULT '0' NOT NULL,
        "totalInvested" numeric(18, 2) DEFAULT 0 NOT NULL,
        "avgCost" numeric(18, 8) DEFAULT '0' NOT NULL,
        "realizedProfit" numeric(18, 2) DEFAULT 0 NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "stockAggregates_stockId_unique" UNIQUE("stockId")
      );
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "openId" varchar(64) NOT NULL,
        "name" text,
        "email" varchar(320),
        "loginMethod" varchar(64),
        "role" "role" DEFAULT 'user' NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "lastSignedIn" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "users_openId_unique" UNIQUE("openId")
      );
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "watchlist" (
        "id" serial PRIMARY KEY NOT NULL,
        "stockId" integer NOT NULL,
        "addedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    console.log("[DB Setup] All tables verified/created successfully");
  } catch (error: any) {
    console.error("[DB Setup] Error setting up tables:", error.message);
    throw error;
  } finally {
    await client.end();
  }
}

