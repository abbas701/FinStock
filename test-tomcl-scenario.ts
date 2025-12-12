import Decimal from "decimal.js";
import { processTransaction } from "./server/db";
import { Transaction } from "./drizzle/schema";

// Initial state
let state = {
  totalShares: new Decimal(0),
  totalInvested: new Decimal(0),
  avgCost: new Decimal(0),
  realizedProfit: new Decimal(0),
};

console.log("Initial state:", {
  totalShares: state.totalShares.toString(),
  totalInvested: state.totalInvested.toString(),
  avgCost: state.avgCost.toString(),
  realizedProfit: state.realizedProfit.toString(),
});

// BUY 500 shares at 100 PKR each
const buy: Transaction = {
  id: 1,
  stockId: 1,
  type: "BUY",
  date: "2025-01-01",
  quantity: "500",
  totalAmount: "50000", // 500 * 100 = 50000 PKR
  unitPrice: "100",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

state = processTransaction(state, buy);
console.log("\nAfter buying 500 shares at 100 PKR each:", {
  totalShares: state.totalShares.toString(),
  totalInvested: state.totalInvested.toString(),
  avgCost: state.avgCost.toString(),
  realizedProfit: state.realizedProfit.toString(),
});

// SELL 250 shares at 120 PKR each
const sell: Transaction = {
  id: 2,
  stockId: 1,
  type: "SELL",
  date: "2025-01-05",
  quantity: "250",
  totalAmount: "30000", // 250 * 120 = 30000 PKR
  unitPrice: "120",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

state = processTransaction(state, sell);
console.log("\nAfter selling 250 shares at 120 PKR each:", {
  totalShares: state.totalShares.toString(),
  totalInvested: state.totalInvested.toString(),
  avgCost: state.avgCost.toString(),
  realizedProfit: state.realizedProfit.toString(),
});

// Expected: 250 shares remaining, avgCost still 100, totalInvested 25000, realizedProfit 5000
console.log("\nExpected values:");
console.log("- totalShares: 250");
console.log("- totalInvested: 25000 (250 * 100)");
console.log("- avgCost: 100 (same as before)");
console.log("- realizedProfit: 5000 (30000 - 25000)");
