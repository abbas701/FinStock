import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb, getAllStocks, getStockById, getStockBySymbol, getStockAggregates, getTransactionsByStockId, createStock, addTransaction, updateTransaction, deleteTransaction, getWatchlist, addToWatchlist, removeFromWatchlist, recomputeAggregates, recomputeAllAggregates } from "./db";
import { getMarketPrice } from "./market";

/**
 * Stock Router
 */
const stockRouter = router({
  /**
   * Create a new stock
   */
  create: protectedProcedure
    .input(z.object({ symbol: z.string(), name: z.string() }))
    .mutation(async ({ input }) => {
      const existing = await getStockBySymbol(input.symbol);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Stock already exists" });
      }

      return await createStock(input.symbol, input.name);
    }),

  /**
   * List all stocks with aggregates
   */
  list: protectedProcedure.query(async () => {
    const stocks = await getAllStocks();

    return await Promise.all(
      stocks.map(async (stock) => {
        const aggregate = await getStockAggregates(stock.id);
        let currentPrice = 0;

        try {
          const priceData = await getMarketPrice(stock.symbol);
          // Only use price if it's greater than 0 (valid price)
          currentPrice = priceData.price > 0 ? priceData.price : 0;
        } catch (error) {
          console.error(`Failed to fetch price for ${stock.symbol}:`, error);
          currentPrice = 0;
        }

        // currentPrice is in paise, avgCost is also in paise (stored as decimal string)
        const avgCostPaise = aggregate ? parseFloat(aggregate.avgCost) : 0;
        const totalShares = aggregate ? parseFloat(aggregate.totalShares) : 0;
        const unrealizedProfit = aggregate && avgCostPaise > 0
          ? (currentPrice - avgCostPaise) * totalShares
          : 0;

        const gainLossPercent = aggregate && avgCostPaise > 0
          ? ((currentPrice - avgCostPaise) / avgCostPaise) * 100
          : 0;

        return {
          id: stock.id,
          symbol: stock.symbol,
          name: stock.name,
          totalShares: aggregate?.totalShares || "0",
          avgCost: aggregate?.avgCost || "0",
          totalInvested: aggregate?.totalInvested || 0,
          currentPrice,
          unrealizedProfit,
          realizedProfit: aggregate?.realizedProfit || 0,
          gainLossPercent,
        };
      })
    );
  }),

  /**
   * Get stock detail with transactions
   */
  getDetail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const stock = await getStockById(input.id);
      if (!stock) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Stock not found" });
      }

      const aggregate = await getStockAggregates(input.id);
      const { transactions } = await getTransactionsByStockId(input.id);

      let currentPrice = 0;
      try {
        const priceData = await getMarketPrice(stock.symbol);
        currentPrice = priceData.price;
      } catch (error) {
        console.error(`Failed to fetch price for ${stock.symbol}:`, error);
      }

      // currentPrice is in paise, avgCost is also in paise (stored as decimal string)
      const avgCostPaise = aggregate ? parseFloat(aggregate.avgCost) : 0;
      const totalShares = aggregate ? parseFloat(aggregate.totalShares) : 0;
      const unrealizedProfit = aggregate && avgCostPaise > 0
        ? (currentPrice - avgCostPaise) * totalShares
        : 0;

      const gainLossPercent = aggregate && avgCostPaise > 0
        ? ((currentPrice - avgCostPaise) / avgCostPaise) * 100
        : 0;

      return {
        stock,
        aggregate,
        currentPrice,
        unrealizedProfit,
        gainLossPercent,
        transactions,
      };
    }),
});

/**
 * Transaction Router
 */
const transactionRouter = router({
  /**
   * Add transaction
   */
  add: protectedProcedure
    .input(
      z.object({
        stockId: z.number(),
        type: z.enum(["BUY", "SELL", "DIVIDEND"]),
        date: z.date(),
        quantity: z.string().nullable(),
        totalAmount: z.number(),
        notes: z.string().optional(),
        confirmOverride: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await addTransaction(
        input.stockId,
        input.type,
        input.date,
        input.quantity,
        input.totalAmount,
        input.notes
      );

      return { message: "Transaction added" };
    }),

  /**
   * Update transaction
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        type: z.enum(["BUY", "SELL", "DIVIDEND"]),
        date: z.date(),
        quantity: z.string().nullable(),
        totalAmount: z.number(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await updateTransaction(
        input.id,
        input.type,
        input.date,
        input.quantity,
        input.totalAmount,
        input.notes
      );

      return { message: "Transaction updated" };
    }),

  /**
   * Delete transaction
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteTransaction(input.id);
      return { message: "Transaction deleted" };
    }),

  /**
   * Recompute aggregates for a specific stock
   */
  recomputeAggregates: protectedProcedure
    .input(z.object({ stockId: z.number() }))
    .mutation(async ({ input }) => {
      await recomputeAggregates(input.stockId);
      return { message: "Aggregates recomputed" };
    }),

  /**
   * Recompute aggregates for all stocks
   */
  recomputeAllAggregates: protectedProcedure.mutation(async () => {
    return await recomputeAllAggregates();
  }),
});

/**
 * Watchlist Router
 */
const watchlistRouter = router({
  /**
   * Get watchlist
   */
  list: protectedProcedure.query(async () => {
    const items = await getWatchlist();

    // Fetch current prices and stock details
    const result = await Promise.all(
      items.map(async (item) => {
        const stock = await getStockById(item.stockId);
        if (!stock) return null;

        let currentPrice = 0;
        let priceChange = 0;

        try {
          const priceData = await getMarketPrice(stock.symbol);
          currentPrice = priceData.price;
        } catch (error) {
          console.error(`Failed to fetch price for ${stock.symbol}:`, error);
        }

        return {
          watchlistId: item.id,
          stock,
          currentPrice,
          priceChange,
        };
      })
    );

    return result.filter((item) => item !== null);
  }),

  /**
   * Add to watchlist
   */
  add: protectedProcedure
    .input(z.object({ stockId: z.number() }))
    .mutation(async ({ input }) => {
      const stock = await getStockById(input.stockId);
      if (!stock) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Stock not found" });
      }

      await addToWatchlist(input.stockId);
      return { message: "Added to watchlist" };
    }),

  /**
   * Remove from watchlist
   */
  remove: protectedProcedure
    .input(z.object({ watchlistId: z.number() }))
    .mutation(async ({ input }) => {
      await removeFromWatchlist(input.watchlistId);
      return { message: "Removed from watchlist" };
    }),
});

/**
 * Reports Router
 */
const reportsRouter = router({
  /**
   * Get daywise profit data
   */
  daywise: protectedProcedure
    .input(z.object({ from: z.date(), to: z.date() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // This is a simplified version - in production you'd aggregate by date
      return [];
    }),
});

/**
 * Auth Router
 */
const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user || null),
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie("session");
    return { success: true };
  }),
});

/**
 * Main App Router
 */
export const appRouter = router({
  auth: authRouter,
  stock: stockRouter,
  transaction: transactionRouter,
  watchlist: watchlistRouter,
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;
