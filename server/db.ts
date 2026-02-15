import { eq, desc, asc, sql, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, users, stocks, transactions, watchlist, stockAggregates, passwordResetTokens, Stock, Transaction, StockAggregate } from "../drizzle/schema";
import { ENV } from './_core/env';
import Decimal from "decimal.js";

// Precision constants for decimal values
const AVG_COST_PRECISION = 4; // Precision for share quantities and avgCost
const SHARE_PRECISION = 2; // Precision for share quantities and avgCost
const CURRENCY_PRECISION = 2; // Precision for currency amounts (PKR)

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
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
      // If creating new user without openId (password auth), ensure mandatory fields
    };

    // If openId is missing, we must be careful. This function assumes openId presence for conflict target in legacy flow.
    // For password flow, we might need a different approach or rely on ID update.
    // Adapting to handle update by ID if present, or OpenID if present.

    if (user.id) {
      await db.update(users).set(user).where(eq(users.id, user.id));
      return;
    }

    if (!user.openId && !user.email) {
      throw new Error("User must have openId or email for upsert");
    }

    // Prepare values
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod", "password", "openId"] as const;

    textFields.forEach((field) => {
      const value = user[field];
      if (value !== undefined) {
        values[field] = value;
        updateSet[field] = value;
      }
    });

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

    // Conflict strategy: try openId match first
    if (user.openId) {
      await db.insert(users).values(values).onConflictDoUpdate({
        target: users.openId,
        set: updateSet,
      });
    } else if (user.email) {
      // If no openId, try email
      await db.insert(users).values(values).onConflictDoUpdate({
        target: users.email,
        set: updateSet,
      });
    }

  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getStockBySymbol(symbol: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stocks).where(eq(stocks.symbol, symbol.toUpperCase())).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ... existing stock creation methods can remain global or be restricted to admin? 
// For now leaving global as shared dictionary.

export async function createStock(symbol: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(stocks).values({ symbol: symbol.toUpperCase(), name }).onConflictDoNothing();

  const newStock = await db.select().from(stocks)
    .where(eq(stocks.symbol, symbol.toUpperCase()))
    .limit(1);

  if (!newStock || newStock.length === 0) {
    throw new Error(`Failed to create/find stock: ${symbol}`);
  }

  return newStock[0];
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
 * ============================================================================
 * TRANSACTIONS (SCOPED BY USER)
 * ============================================================================
 */

export async function getTransactionsByStockId(userId: number, stockId: number, limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return { transactions: [], total: 0 };

  const whereClause = and(eq(transactions.stockId, stockId), eq(transactions.userId, userId));

  const result = await db
    .select()
    .from(transactions)
    .where(whereClause)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql`COUNT(*)` })
    .from(transactions)
    .where(whereClause);

  const total = countResult.length > 0 ? Number(countResult[0].count) : 0;

  return { transactions: result, total };
}

export async function addTransaction(
  userId: number,
  stockId: number,
  type: "BUY" | "SELL" | "DIVIDEND",
  date: Date,
  quantity: string | null,
  totalAmount: string,
  notes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const dateStr = date.toISOString().split("T")[0];

  try {
    await db.insert(transactions).values({
      userId,
      stockId,
      type,
      date: dateStr,
      quantity: quantity || null,
      totalAmount,
      notes: notes || null,
    });

    await recomputeAggregates(userId, stockId);
  } catch (error) {
    console.error(`[DB] Failed to add transaction:`, error);
    throw new Error(`Failed to add transaction: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function updateTransaction(
  userId: number,
  id: number,
  type: "BUY" | "SELL" | "DIVIDEND",
  date: Date,
  quantity: string | null,
  totalAmount: string,
  notes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const dateStr = date.toISOString().split("T")[0];

  try {
    const txn = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1);
    if (!txn || txn.length === 0) throw new Error("Transaction not found");

    const stockId = txn[0].stockId;

    await db.update(transactions)
      .set({ type, date: dateStr, quantity: quantity || null, totalAmount, notes: notes || null, updatedAt: new Date() })
      .where(eq(transactions.id, id));

    await recomputeAggregates(userId, stockId);
  } catch (error) {
    console.error(`[DB] Failed to update transaction ${id}:`, error);
    throw new Error(`Failed to update transaction: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function deleteTransaction(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const txn = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1);
    if (!txn || txn.length === 0) throw new Error("Transaction not found");

    const stockId = txn[0].stockId;

    await db.delete(transactions).where(eq(transactions.id, id));

    await recomputeAggregates(userId, stockId);
  } catch (error) {
    console.error(`[DB] Failed to delete transaction ${id}:`, error);
    throw new Error(`Failed to delete transaction: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function recomputeAggregates(userId: number, stockId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const txns = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.stockId, stockId), eq(transactions.userId, userId)))
    .orderBy(asc(transactions.date), asc(transactions.createdAt));

  let state = {
    totalShares: new Decimal(0),
    totalInvested: new Decimal(0),
    avgCost: new Decimal(0),
    realizedProfit: new Decimal(0),
  };

  // Track same-day purchases for intraday trading logic
  let currentDate = "";
  let sameDayBuys: Array<{ quantity: Decimal; unitPrice: Decimal }> = [];

  for (const txn of txns) {
    // Reset same-day tracking when date changes
    if (txn.date !== currentDate) {
      currentDate = txn.date;
      sameDayBuys = [];
    }

    state = processTransaction(state, txn, sameDayBuys);
  }

  const existingAggregate = await db
    .select()
    .from(stockAggregates)
    .where(and(eq(stockAggregates.stockId, stockId), eq(stockAggregates.userId, userId)))
    .limit(1);

  const aggregateValues = {
    totalShares: state.totalShares.toFixed(0),
    totalInvested: state.totalInvested.toFixed(2),
    avgCost: state.avgCost.toFixed(4),
    realizedProfit: state.realizedProfit.toFixed(4),
  };

  try {
    if (existingAggregate.length === 0) {
      await db.insert(stockAggregates).values({
        userId,
        stockId,
        ...aggregateValues,
      });
    } else {
      await db
        .update(stockAggregates)
        .set({
          ...aggregateValues,
          updatedAt: new Date(),
        })
        .where(eq(stockAggregates.id, existingAggregate[0].id));
    }
  } catch (error) {
    console.error(`[DB] Failed to update stockAggregates:`, error);
    throw new Error(`Failed to update stock aggregates`);
  }
}

export function processTransaction(
  state: {
    totalShares: Decimal;
    totalInvested: Decimal;
    avgCost: Decimal;
    realizedProfit: Decimal;
  },
  txn: Transaction,
  sameDayBuys: Array<{ quantity: Decimal; unitPrice: Decimal }> = []
) {
  const quantity = txn.quantity ? new Decimal(txn.quantity) : new Decimal(0);
  const totalAmount = new Decimal(txn.totalAmount);

  if (txn.type === "BUY") {
    const newTotalShares = state.totalShares.plus(quantity);
    const newTotalInvested = state.totalInvested.plus(totalAmount);
    const newAvgCost = newTotalShares.isZero() ? new Decimal(0) : newTotalInvested.dividedBy(newTotalShares);

    // Track this buy for potential same-day selling
    const unitPrice = quantity.isZero() ? new Decimal(0) : totalAmount.dividedBy(quantity);
    sameDayBuys.push({ quantity, unitPrice });

    return { ...state, totalShares: newTotalShares, totalInvested: newTotalInvested, avgCost: newAvgCost };
  } else if (txn.type === "SELL") {
    const sharesToSell = quantity;
    const proceeds = totalAmount;
    let remainingToSell = sharesToSell;
    let costRemoved = new Decimal(0);

    // First, try to match with same-day buys (FIFO)
    for (let i = 0; i < sameDayBuys.length && remainingToSell.greaterThan(0); i++) {
      const buy = sameDayBuys[i];
      if (buy.quantity.greaterThan(0)) {
        const qtyToMatch = Decimal.min(buy.quantity, remainingToSell);
        costRemoved = costRemoved.plus(qtyToMatch.times(buy.unitPrice));
        buy.quantity = buy.quantity.minus(qtyToMatch);
        remainingToSell = remainingToSell.minus(qtyToMatch);
      }
    }

    // If there are still shares to sell, use the average cost for remaining
    if (remainingToSell.greaterThan(0)) {
      costRemoved = costRemoved.plus(state.avgCost.times(remainingToSell));
    }

    const realizedProfitThisTxn = proceeds.minus(costRemoved);
    const newTotalShares = state.totalShares.minus(sharesToSell);
    const newTotalInvested = state.totalInvested.minus(costRemoved);
    const newAvgCost = newTotalShares.isZero() ? new Decimal(0) : state.avgCost;

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

export async function getStockAggregates(userId: number, stockId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(stockAggregates)
    .where(and(eq(stockAggregates.stockId, stockId), eq(stockAggregates.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(watchlist.addedAt);
}

export async function addToWatchlist(userId: number, stockId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(watchlist)
    .where(and(eq(watchlist.stockId, stockId), eq(watchlist.userId, userId)))
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error("Stock already in watchlist");
  }

  await db.insert(watchlist).values({ userId, stockId });
}

export async function removeFromWatchlist(userId: number, watchlistId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(watchlist).where(and(eq(watchlist.id, watchlistId), eq(watchlist.userId, userId)));
}
