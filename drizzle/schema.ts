import { integer, pgEnum, pgTable, text, timestamp, varchar, decimal, date, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Stock table: stores stock symbols and names.
 * Single-user design: no userId column required.
 */
export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = typeof stocks.$inferInsert;

/**
 * Transaction table: stores buy, sell, and dividend transactions.
 * Amounts stored as DECIMAL in PKR for precision.
 * unitPrice is computed as totalAmount / quantity for BUY/SELL.
 */
export const transactionTypeEnum = pgEnum("transaction_type", ["BUY", "SELL", "DIVIDEND"]);

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  stockId: integer("stockId").notNull(),
  type: transactionTypeEnum("type").notNull(),
  date: date("date").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 8 }), // nullable for DIVIDEND
  totalAmount: decimal("totalAmount", { precision: 18, scale: 2 }).notNull(), // in PKR
  unitPrice: decimal("unitPrice", { precision: 18, scale: 8 }), // computed for BUY/SELL
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Watchlist table: stores stocks added to user's watchlist.
 */
export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  stockId: integer("stockId").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = typeof watchlist.$inferInsert;

/**
 * Stock aggregates: cached aggregates for performance.
 * Recomputed when transactions are added/edited/deleted.
 */
export const stockAggregates = pgTable("stockAggregates", {
  id: serial("id").primaryKey(),
  stockId: integer("stockId").notNull().unique(),
  totalShares: decimal("totalShares", { precision: 18, scale: 8 }).notNull().default("0"),
  totalInvested: decimal("totalInvested", { precision: 18, scale: 2 }).notNull().default("0"), // in PKR
  avgCost: decimal("avgCost", { precision: 18, scale: 8 }).notNull().default("0"), // in PKR per share
  realizedProfit: decimal("realizedProfit", { precision: 18, scale: 2 }).notNull().default("0"), // in PKR
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type StockAggregate = typeof stockAggregates.$inferSelect;
export type InsertStockAggregate = typeof stockAggregates.$inferInsert;

// Relations
export const stocksRelations = relations(stocks, ({ many }) => ({
  transactions: many(transactions),
  watchlistEntries: many(watchlist),
  aggregates: many(stockAggregates),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  stock: one(stocks, {
    fields: [transactions.stockId],
    references: [stocks.id],
  }),
}));

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  stock: one(stocks, {
    fields: [watchlist.stockId],
    references: [stocks.id],
  }),
}));

export const stockAggregatesRelations = relations(stockAggregates, ({ one }) => ({
  stock: one(stocks, {
    fields: [stockAggregates.stockId],
    references: [stocks.id],
  }),
}));