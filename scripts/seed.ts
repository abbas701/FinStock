import "dotenv/config";
import { getDb, createStock, addTransaction, upsertUser, getUserByEmail } from "../server/db";
import { users } from "../drizzle/schema"; // Ensure this path is correct relative to scripts/seed.ts
import { eq } from "drizzle-orm";
import { sdk } from "../server/_core/sdk"; // Ensure sdk is exported and path is correct

/**
 * Seed script for populating PSX stocks
 * Run with: npm run seed
 */

async function main() {
  console.log("Starting seed with PSX stocks...");

  const db = await getDb();
  if (!db) {
    throw new Error("Database connection failed");
  }

  // Ensure a default admin user exists for seeding
  const adminEmail = "admin@example.com";
  const adminPassword = "password123";
  let user = await getUserByEmail(adminEmail);

  if (!user) {
    console.log("Creating default admin user for seeding...");

    const hashedPassword = await sdk.hashPassword(adminPassword);

    await upsertUser({
      email: adminEmail,
      name: "Admin User",
      loginMethod: "password",
      role: "admin",
      password: hashedPassword,
      openId: null,
      lastSignedIn: new Date()
    });

    user = await getUserByEmail(adminEmail);
    console.log(`✓ Created admin user: ${adminEmail}`);
    console.log(`✓ Password: ${adminPassword}`);
  } else {
    console.log(`Using existing user: ${user.email}`);
    // Ideally we should update the password here if it's missing, but let's assume if it exists it's fine 
    // or the user can delete it to reset.
    // Actually, if the user ran the OLD seed, the user exists but has NO password.
    // So we SHOULD update it if password is null.
    if (!user.password) {
      console.log("Existing user has no password. Updating with default...");
      const hashedPassword = await sdk.hashPassword(adminPassword);
      await upsertUser({
        ...user,
        password: hashedPassword,
        loginMethod: "password",
        role: "admin" // ensure admin
      });
      console.log(`✓ Updated admin user password to: ${adminPassword}`);
    }
  }

  if (!user) {
    throw new Error("Could not find or create a user for seeding.");
  }

  const userId = user.id;

  // PSX stocks provided by user
  const stocks = [
    { symbol: "SAZEW", name: "Sazew Limited" },
    { symbol: "PIBTL", name: "Pakistan Industrial Batteries Limited" },
    { symbol: "TOMCL", name: "Tomcl Limited" },
    { symbol: "SEARL", name: "Searl Limited" },
    { symbol: "KEL", name: "Kisan Electric Limited" },
    { symbol: "HUBC", name: "Hub Power Company Limited" },
    { symbol: "OGDC", name: "Oil and Gas Development Company Limited" },
    { symbol: "MEBL", name: "Mebl Limited" },
    { symbol: "ENGROH", name: "Engro Corporation Limited" },
    { symbol: "HALEON", name: "Haleon Limited" },
    { symbol: "AVN", name: "Avanceon Limited" },
    { symbol: "FCEPL", name: "Fauji Cement Company Limited" },
    { symbol: "WTL", name: "Wittol Limited" },
    { symbol: "DHPL", name: "Dewan Hussain Limited" },
    { symbol: "LCI", name: "Lotte Chemical Titan Limited" },
    { symbol: "FHAM", name: "Fham Limited" },
    { symbol: "STPL", name: "Stpl Limited" },
    { symbol: "TBL", name: "Tariq Bottling Limited" },
    { symbol: "AHCL", name: "Ahcl Limited" },
    { symbol: "ZAL", name: "Zal Limited" },
    { symbol: "PAEL", name: "Pael Limited" },
    { symbol: "FABL", name: "Fabl Limited" },
    { symbol: "CPHL", name: "Cphl Limited" },
    { symbol: "SSGC", name: "Sui Southern Gas Company Limited" },
    { symbol: "SYS", name: "Sys Limited" },
    { symbol: "LOADS", name: "Loads Limited" },
    { symbol: "MLCF", name: "Mlcf Limited" },
  ];

  const createdStocks: { [key: string]: number } = {};

  for (const stock of stocks) {
    try {
      const result = await createStock(stock.symbol, stock.name);
      createdStocks[stock.symbol] = result.id;
      // console.log(`✓ Created stock: ${stock.symbol}`);
    } catch (error: any) {
      if (error.message?.includes("Duplicate")) {
        // console.log(`⚠ Stock ${stock.symbol} already exists`);
      } else {
        console.error(`✗ Error creating stock ${stock.symbol}:`, error.message);
      }
    }
  }

  // Helper to find ID if not in createdStocks (e.g. duplicate)
  const getStockId = async (symbol: string) => {
    if (createdStocks[symbol]) return createdStocks[symbol];
    const s = await db.select().from(require("../drizzle/schema").stocks).where(eq(require("../drizzle/schema").stocks.symbol, symbol)).limit(1);
    return s.length > 0 ? s[0].id : 0;
  };

  // Add sample transactions for KEL (Kisan Electric)
  const kelId = await getStockId("KEL");

  if (kelId) {
    try {
      // BUY 1: 100 shares at 500 PKR each = 50,000 PKR total
      await addTransaction(
        userId,
        kelId,
        "BUY",
        new Date("2024-01-01"),
        "100",
        "50000",
        "Initial purchase"
      );
      console.log("✓ Added BUY transaction for KEL: 100 shares @ 500 PKR");

      // BUY 2: 50 shares at 600 PKR each = 30,000 PKR total
      await addTransaction(
        userId,
        kelId,
        "BUY",
        new Date("2024-01-15"),
        "50",
        "30000",
        "Second purchase"
      );
      console.log("✓ Added BUY transaction for KEL: 50 shares @ 600 PKR");

      // SELL: 75 shares at 700 PKR each = 52,500 PKR total
      await addTransaction(
        userId,
        kelId,
        "SELL",
        new Date("2024-02-01"),
        "75",
        "52500",
        "Partial sale"
      );
      console.log("✓ Added SELL transaction for KEL: 75 shares @ 700 PKR");

      // DIVIDEND: 500 PKR dividend
      await addTransaction(
        userId,
        kelId,
        "DIVIDEND",
        new Date("2024-03-01"),
        null,
        "500",
        "Dividend payout"
      );
      console.log("✓ Added DIVIDEND transaction for KEL: 500 PKR");
    } catch (error: any) {
      if (!error.message?.includes("Duplicate")) { // Suppress if duplicate (not likely for transactions with ID PK)
        console.error("✗ Error adding KEL transactions:", error.message);
      }
    }
  }

  console.log("\n✓ Seed completed successfully!");
}

main()
  .catch((error) => {
    console.error("✗ Seed failed:", error);
    process.exit(1);
  });
