import { eq, desc, asc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, users, stocks, transactions, watchlist, stockAggregates, Stock, Transaction, StockAggregate } from "../drizzle/schema";
import { ENV } from './_core/env';
import Decimal from "decimal.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL);
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _client = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * ============================================================================
 * STOCK & TRANSACTION QUERIES
 * ============================================================================
 */

export async function createStock(symbol: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Insert stock and get the inserted row
  await db.insert(stocks).values({ symbol: symbol.toUpperCase(), name });
  
  // Fetch the newly created stock to get its ID
  const newStock = await db.select().from(stocks)
    .where(eq(stocks.symbol, symbol.toUpperCase()))
    .limit(1);
  
  if (!newStock || newStock.length === 0) {
    throw new Error(`Failed to create stock: ${symbol}`);
  }

  const stockId = newStock[0].id;

  // Create aggregate entry with default values
  await db.insert(stockAggregates).values({
    stockId,
    totalShares: "0",
    totalInvested: "0",
    avgCost: "0",
    realizedProfit: "0",
  });

  return { id: stockId, symbol: symbol.toUpperCase(), name };
}

export async function getStockBySymbol(symbol: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(stocks).where(eq(stocks.symbol, symbol.toUpperCase())).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getStockById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(stocks).where(eq(stocks.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllStocks() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(stocks).orderBy(stocks.symbol);
}

/**
 * Recompute aggregates for all stocks
 * Useful for fixing data inconsistencies
 */
export async function recomputeAllAggregates() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allStocks = await getAllStocks();
  console.log(`[DB] Recomputing aggregates for ${allStocks.length} stocks`);

  for (const stock of allStocks) {
    try {
      await recomputeAggregates(stock.id);
    } catch (error) {
      console.error(`[DB] Failed to recompute aggregates for stock ${stock.symbol} (id: ${stock.id}):`, error);
    }
  }

  return { message: `Recomputed aggregates for ${allStocks.length} stocks` };
}

export async function getTransactionsByStockId(stockId: number, limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return { transactions: [], total: 0 };

  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.stockId, stockId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql`COUNT(*)` })
    .from(transactions)
    .where(eq(transactions.stockId, stockId));

  const total = countResult.length > 0 ? Number(countResult[0].count) : 0;

  return { transactions: result, total };
}

export async function addTransaction(
  stockId: number,
  type: "BUY" | "SELL" | "DIVIDEND",
  date: Date,
  quantity: string | null,
  totalAmount: string,
  notes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Format date to YYYY-MM-DD for PostgreSQL
  const dateStr = date.toISOString().split("T")[0];

  // Insert transaction
  await db.insert(transactions).values({
    stockId,
    type,
    date: dateStr,
    quantity: quantity || null,
    totalAmount,
    notes: notes || null,
  });

  // Recompute aggregates
  await recomputeAggregates(stockId);
}

export async function updateTransaction(
  id: number,
  type: "BUY" | "SELL" | "DIVIDEND",
  date: Date,
  quantity: string | null,
  totalAmount: string,
  notes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Format date to YYYY-MM-DD for PostgreSQL
  const dateStr = date.toISOString().split("T")[0];

  const txn = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!txn || txn.length === 0) throw new Error("Transaction not found");

  const stockId = txn[0].stockId;

  await db.update(transactions)
    .set({ type, date: dateStr, quantity: quantity || null, totalAmount, notes: notes || null, updatedAt: new Date() })
    .where(eq(transactions.id, id));

  // Recompute aggregates
  await recomputeAggregates(stockId);
}

export async function deleteTransaction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const txn = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!txn || txn.length === 0) throw new Error("Transaction not found");

  const stockId = txn[0].stockId;

  await db.delete(transactions).where(eq(transactions.id, id));

  // Recompute aggregates
  await recomputeAggregates(stockId);
}

/**
 * Recompute aggregates by replaying all transactions for a stock
 */
export async function recomputeAggregates(stockId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all transactions ordered by date (ascending) and then by creation time
  const txns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.stockId, stockId))
    .orderBy(asc(transactions.date), asc(transactions.createdAt));

  console.log(`[DB] Recomputing aggregates for stockId ${stockId}, found ${txns.length} transactions`);

  // Replay transactions
  let state = {
    totalShares: new Decimal(0),
    totalInvested: new Decimal(0),
    avgCost: new Decimal(0),
    realizedProfit: new Decimal(0),
  };

  for (const txn of txns) {
    const beforeState = { ...state };
    state = processTransaction(state, txn);
    console.log(`[DB] Processing ${txn.type} transaction ${txn.id}: qty=${txn.quantity}, amount=${txn.totalAmount}, shares: ${beforeState.totalShares.toString()} -> ${state.totalShares.toString()}`);
  }

  console.log(`[DB] Final state for stockId ${stockId}: shares=${state.totalShares.toString()}, invested=${state.totalInvested.toString()}, avgCost=${state.avgCost.toString()}`);

  // Ensure aggregate exists, then update
  const existingAggregate = await db
    .select()
    .from(stockAggregates)
    .where(eq(stockAggregates.stockId, stockId))
    .limit(1);

  if (existingAggregate.length === 0) {
    // Create aggregate if it doesn't exist
    console.log(`[DB] Creating new aggregate for stockId ${stockId}`);
    await db.insert(stockAggregates).values({
      stockId,
      totalShares: state.totalShares.toString(),
      totalInvested: state.totalInvested.toString(),
      avgCost: state.avgCost.toString(),
      realizedProfit: state.realizedProfit.toString(),
    });
  } else {
    // Update existing aggregate
    console.log(`[DB] Updating existing aggregate for stockId ${stockId}`);
    await db
      .update(stockAggregates)
      .set({
        totalShares: state.totalShares.toString(),
        totalInvested: state.totalInvested.toString(),
        avgCost: state.avgCost.toString(),
        realizedProfit: state.realizedProfit.toString(),
        updatedAt: new Date(),
      })
      .where(eq(stockAggregates.stockId, stockId));
  }
}

/**
 * Process a single transaction and update state
 * All amounts are in PKR (not paise)
 */
export function processTransaction(
  state: {
    totalShares: Decimal;
    totalInvested: Decimal;
    avgCost: Decimal;
    realizedProfit: Decimal;
  },
  txn: Transaction
) {
  const quantity = txn.quantity ? new Decimal(txn.quantity) : new Decimal(0);
  const totalAmount = new Decimal(txn.totalAmount);

  if (txn.type === "BUY") {
    const newTotalShares = state.totalShares.plus(quantity);
    const newTotalInvested = state.totalInvested.plus(totalAmount);
    const newAvgCost = newTotalShares.isZero() ? new Decimal(0) : newTotalInvested.dividedBy(newTotalShares);

    return {
      ...state,
      totalShares: newTotalShares,
      totalInvested: newTotalInvested,
      avgCost: newAvgCost,
    };
  } else if (txn.type === "SELL") {
    const costRemoved = state.avgCost.times(quantity);
    const proceeds = totalAmount;
    const realizedProfitThisTxn = proceeds.minus(costRemoved);

    const newTotalShares = state.totalShares.minus(quantity);
    const newTotalInvested = state.totalInvested.minus(costRemoved);
    const newAvgCost = newTotalShares.isZero() ? new Decimal(0) : newTotalInvested.dividedBy(newTotalShares);

    return {
      totalShares: newTotalShares,
      totalInvested: newTotalInvested,
      avgCost: newAvgCost,
      realizedProfit: state.realizedProfit.plus(realizedProfitThisTxn),
    };
  } else if (txn.type === "DIVIDEND") {
    return {
      ...state,
      realizedProfit: state.realizedProfit.plus(totalAmount),
    };
  }

  return state;
}

export async function getStockAggregates(stockId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(stockAggregates).where(eq(stockAggregates.stockId, stockId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getWatchlist() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(watchlist).orderBy(watchlist.addedAt);
}

export async function addToWatchlist(stockId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if already in watchlist
  const existing = await db.select().from(watchlist).where(eq(watchlist.stockId, stockId)).limit(1);
  if (existing && existing.length > 0) {
    throw new Error("Stock already in watchlist");
  }

  await db.insert(watchlist).values({ stockId });
}

export async function removeFromWatchlist(watchlistId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(watchlist).where(eq(watchlist.id, watchlistId));
}
