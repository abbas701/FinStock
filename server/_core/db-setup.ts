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
    // Create ENUM types if they don't exist.
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

    // Create canonical tables (matching drizzle schema + CSV import structure).
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "openId" varchar(64),
        "password" text,
        "name" text,
        "email" varchar(320),
        "loginMethod" varchar(64),
        "role" "role" DEFAULT 'user' NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "lastSignedIn" timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "stocks" (
        "id" serial PRIMARY KEY NOT NULL,
        "symbol" varchar(10) NOT NULL,
        "name" varchar(255) NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" serial PRIMARY KEY NOT NULL,
        "userId" integer,
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
        "userId" integer,
        "stockId" integer NOT NULL,
        "totalShares" numeric(18, 8) DEFAULT '0' NOT NULL,
        "totalInvested" numeric(18, 2) DEFAULT 0 NOT NULL,
        "avgCost" numeric(18, 8) DEFAULT '0' NOT NULL,
        "realizedProfit" numeric(18, 2) DEFAULT 0 NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "watchlist" (
        "id" serial PRIMARY KEY NOT NULL,
        "userId" integer,
        "stockId" integer NOT NULL,
        "addedAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" serial PRIMARY KEY NOT NULL,
        "userId" integer NOT NULL,
        "token" varchar(255) NOT NULL,
        "expiresAt" timestamp NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Patch existing installs that were created with the older bootstrap script.
    await client.unsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" text;`);
    await client.unsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" varchar(320);`);
    await client.unsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "loginMethod" varchar(64);`);
    await client.unsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSignedIn" timestamp DEFAULT now() NOT NULL;`);

    await client.unsafe(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "userId" integer;`);
    await client.unsafe(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "unitPrice" numeric(18, 8);`);
    await client.unsafe(`ALTER TABLE "stockAggregates" ADD COLUMN IF NOT EXISTS "userId" integer;`);
    await client.unsafe(`ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "userId" integer;`);

    // Unique constraints/indexes that match schema/import expectations.
    await client.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "users" ADD CONSTRAINT "users_openId_unique" UNIQUE("openId");
      EXCEPTION
        WHEN duplicate_table OR duplicate_object THEN null;
      END $$;
    `);

    await client.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
      EXCEPTION
        WHEN duplicate_table OR duplicate_object THEN null;
      END $$;
    `);

    await client.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "stocks" ADD CONSTRAINT "stocks_symbol_unique" UNIQUE("symbol");
      EXCEPTION
        WHEN duplicate_table OR duplicate_object THEN null;
      END $$;
    `);

    await client.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "stockAggregates" ADD CONSTRAINT "stockAggregates_user_stock_unique" UNIQUE("userId", "stockId");
      EXCEPTION
        WHEN duplicate_table OR duplicate_object THEN null;
      END $$;
    `);

    await client.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token");
      EXCEPTION
        WHEN duplicate_table OR duplicate_object THEN null;
      END $$;
    `);

    // Foreign keys are applied with defensive blocks to avoid crashing if already present.
    await client.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "transactions"
          ADD CONSTRAINT "transactions_userId_fk"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "stockAggregates"
          ADD CONSTRAINT "stockAggregates_userId_fk"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "watchlist"
          ADD CONSTRAINT "watchlist_userId_fk"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "password_reset_tokens"
          ADD CONSTRAINT "password_reset_tokens_userId_fk"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log("[DB Setup] All tables verified/created successfully");
  } catch (error: any) {
    console.error("[DB Setup] Error setting up tables:", error.message);
    throw error;
  } finally {
    await client.end();
  }
}

