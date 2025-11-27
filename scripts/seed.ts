import { getDb, createStock, addTransaction } from "../server/db";

/**
 * Seed script for populating PSX stocks
 * Run with: npm run seed (or: tsx scripts/seed.ts)
 */

async function main() {
  console.log("Starting seed with PSX stocks...");

  const db = await getDb();
  if (!db) {
    throw new Error("Database connection failed");
  }

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
      console.log(`✓ Created stock: ${stock.symbol}`);
    } catch (error: any) {
      if (error.message?.includes("Duplicate")) {
        console.log(`⚠ Stock ${stock.symbol} already exists`);
      } else {
        console.error(`✗ Error creating stock ${stock.symbol}:`, error.message);
      }
    }
  }

  // Add sample transactions for KEL (Kisan Electric) - the example from requirements
  if (createdStocks["KEL"]) {
    const kelId = createdStocks["KEL"];

    try {
      // BUY 1: 100 shares at 500 PKR each = 50,000 PKR total (5,000,000 paise)
      await addTransaction(
        kelId,
        "BUY",
        new Date("2024-01-01"),
        "100",
        5000000,
        "Initial purchase"
      );
      console.log("✓ Added BUY transaction for KEL: 100 shares @ 500 PKR");

      // BUY 2: 50 shares at 600 PKR each = 30,000 PKR total (3,000,000 paise)
      await addTransaction(
        kelId,
        "BUY",
        new Date("2024-01-15"),
        "50",
        3000000,
        "Second purchase"
      );
      console.log("✓ Added BUY transaction for KEL: 50 shares @ 600 PKR");

      // SELL: 75 shares at 700 PKR each = 52,500 PKR total (5,250,000 paise)
      await addTransaction(
        kelId,
        "SELL",
        new Date("2024-02-01"),
        "75",
        5250000,
        "Partial sale"
      );
      console.log("✓ Added SELL transaction for KEL: 75 shares @ 700 PKR");

      // DIVIDEND: 500 PKR dividend (50,000 paise)
      await addTransaction(
        kelId,
        "DIVIDEND",
        new Date("2024-03-01"),
        null,
        50000,
        "Dividend payout"
      );
      console.log("✓ Added DIVIDEND transaction for KEL: 500 PKR");
    } catch (error) {
      console.error("✗ Error adding KEL transactions:", error);
    }
  }

  console.log("\n✓ Seed completed successfully!");
  console.log(`✓ Total stocks created: ${Object.keys(createdStocks).length}`);
}

main()
  .catch((error) => {
    console.error("✗ Seed failed:", error);
    process.exit(1);
  });

