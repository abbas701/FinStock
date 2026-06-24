import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { addTransaction, updateTransaction, deleteTransaction, recomputeAggregates, getTransactionsByStockId } from "../db";
import { eq, and, gte, lte, sql, desc, asc, inArray, or, like } from "drizzle-orm";
import { getDb } from "../db";
import { transactions, stocks, stockAggregates } from "../../drizzle/schema";
import { getStockById } from "../db";

export const transactionRouter = router({
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
        totalAmount: z.string(),
        notes: z.string().optional(),
        confirmOverride: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await addTransaction(
        ctx.user.id,
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
        totalAmount: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await updateTransaction(
        ctx.user.id,
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
    .mutation(async ({ input, ctx }) => {
      await deleteTransaction(ctx.user.id, input.id);
      return { message: "Transaction deleted" };
    }),

  /**
   * Recompute aggregates for a specific stock
   */
  recomputeAggregates: protectedProcedure
    .input(z.object({ stockId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await recomputeAggregates(ctx.user.id, input.stockId);
      return { message: "Aggregates recomputed" };
    }),

  /**
   * Recompute aggregates for all stocks (Disabled)
   */
  recomputeAllAggregates: protectedProcedure.mutation(async () => {
    return { message: "Global recompute disabled" };
  }),

  /**
   * Get running balance over a date range for charting
   */
  runningBalanceRange: protectedProcedure
    .input(
      z.object({
        from: z.date(),
        to: z.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) return [];

        console.log("📊 Running Balance Query:", { userId: ctx.user.id, from: input.from, to: input.to });

        // Convert Date objects to date strings for comparison
        const fromDateStr = input.from instanceof Date ? input.from.toISOString().split('T')[0] : input.from;
        const toDateStr = input.to instanceof Date ? input.to.toISOString().split('T')[0] : input.to;

        console.log("📅 Date range (strings):", { fromDateStr, toDateStr });

        const allTransactions = await db
          .select({
            id: transactions.id,
            stockId: transactions.stockId,
            type: transactions.type,
            date: transactions.date,
            quantity: transactions.quantity,
            totalAmount: transactions.totalAmount,
            unitPrice: transactions.unitPrice,
            stockSymbol: stocks.symbol,
            stockName: stocks.name,
          })
          .from(transactions)
          .leftJoin(stocks, eq(transactions.stockId, stocks.id))
          .where(
            and(
              eq(transactions.userId, ctx.user.id),
              lte(transactions.date, toDateStr as any)
            )
          )
          .orderBy(asc(transactions.date), asc(transactions.createdAt));

        console.log("📦 Total transactions fetched:", allTransactions.length);
        if (allTransactions.length > 0) {
          console.log("📝 Sample transaction:", allTransactions[0]);
        }

      // Group by date
      const txnByDate: Record<string, any[]> = {};
      for (const txn of allTransactions) {
        const dateKey = txn.date.toString();
        if (!txnByDate[dateKey]) {
          txnByDate[dateKey] = [];
        }
        txnByDate[dateKey].push(txn);
      }

      // Calculate running balance for each date
      const resultByDate: Record<string, any> = {};
      let totalInvested = 0;
      let totalRealized = 0;
      let totalDividends = 0;
      let shares: Record<number, { symbol: string; name: string; quantity: number; costBasis: number }> = {};

      for (const txn of allTransactions) {
        const stockId = txn.stockId;
        const amount = parseFloat(txn.totalAmount || "0");
        const qty = parseFloat(txn.quantity || "0");

        if (!shares[stockId]) {
          shares[stockId] = {
            symbol: txn.stockSymbol || "Unknown",
            name: txn.stockName || "Unknown",
            quantity: 0,
            costBasis: 0,
          };
        }

        if (txn.type === "BUY") {
          const prevQty = shares[stockId].quantity;
          const prevCost = shares[stockId].costBasis;
          shares[stockId].quantity += qty;
          shares[stockId].costBasis = ((prevQty * prevCost) + amount) / (shares[stockId].quantity || 1);
          totalInvested += amount;
        } else if (txn.type === "SELL") {
          const sellCost = shares[stockId].costBasis * qty;
          totalRealized += amount - sellCost;
          shares[stockId].quantity -= qty;
          if (shares[stockId].quantity < 0.001) {
            shares[stockId].quantity = 0;
          }
        } else if (txn.type === "DIVIDEND") {
          totalDividends += amount;
          totalInvested += amount; // Dividends are reinvested
        }

        // Only add to result if date is within range
        const txnDateStr = txn.date instanceof Date ? txn.date.toISOString().split('T')[0] : txn.date.toString();
        if (txnDateStr >= fromDateStr && txnDateStr <= toDateStr) {
          resultByDate[txnDateStr] = {
            date: txnDateStr,
            totalInvested,
            totalRealized,
            totalDividends,
            netBalance: totalInvested + totalRealized + totalDividends,
          };
        }
      }

        const result = Object.values(resultByDate);
        console.log("🎯 Running balance result:", { count: result.length, data: result.slice(0, 3) });
        return result;
      } catch (error) {
        console.error("❌ Running balance query error:", error);
        throw error;
      }
    }),

  /**
   * Get running balance as of a specific date
   */
  runningBalance: protectedProcedure
    .input(
      z.object({
        asOfDate: z.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { date: input.asOfDate, stocks: [], totalInvested: 0, totalRealized: 0, totalDividends: 0 };

      const conditions = [
        eq(transactions.userId, ctx.user.id),
        lte(transactions.date, input.asOfDate),
      ];

      const allTransactions = await db
        .select({
          id: transactions.id,
          stockId: transactions.stockId,
          type: transactions.type,
          date: transactions.date,
          quantity: transactions.quantity,
          totalAmount: transactions.totalAmount,
          unitPrice: transactions.unitPrice,
          stockSymbol: stocks.symbol,
          stockName: stocks.name,
        })
        .from(transactions)
        .leftJoin(stocks, eq(transactions.stockId, stocks.id))
        .where(and(...conditions))
        .orderBy(asc(transactions.date), asc(transactions.createdAt));

      // Group transactions by stock and calculate running totals
      const stockBalances: Record<number, any> = {};
      let totalInvested = 0;
      let totalDividends = 0;
      let realizedProfit = 0;
      let shares: Record<number, { symbol: string; name: string; quantity: number; costBasis: number }> = {};

      for (const txn of allTransactions) {
        const stockId = txn.stockId;
        const amount = parseFloat(txn.totalAmount || "0");
        const qty = parseFloat(txn.quantity || "0");

        if (!shares[stockId]) {
          shares[stockId] = {
            symbol: txn.stockSymbol || "Unknown",
            name: txn.stockName || "Unknown",
            quantity: 0,
            costBasis: 0,
          };
        }

        if (txn.type === "BUY") {
          const prevQty = shares[stockId].quantity;
          const prevCost = shares[stockId].costBasis;
          shares[stockId].quantity += qty;
          shares[stockId].costBasis = ((prevQty * prevCost) + amount) / (shares[stockId].quantity || 1);
          totalInvested += amount;
        } else if (txn.type === "SELL") {
          const sellCost = shares[stockId].costBasis * qty;
          realizedProfit += amount - sellCost;
          shares[stockId].quantity -= qty;
          if (shares[stockId].quantity < 0.001) {
            shares[stockId].quantity = 0;
          }
        } else if (txn.type === "DIVIDEND") {
          totalDividends += amount;
          totalInvested += amount; // Dividends are reinvested
        }
      }

      // Filter out zero holdings
      const activeStocks = Object.entries(shares)
        .filter(([_, s]) => s.quantity > 0.001)
        .map(([_, s]) => s);

      return {
        date: input.asOfDate,
        stocks: activeStocks,
        totalInvested,
        totalRealized: realizedProfit,
        totalDividends,
        allTransactions,
      };
    }),

  /**
   * Get all transactions for audit/review with grouping options
   */
  audit: protectedProcedure
    .input(
      z.object({
        groupBy: z.enum(["none", "date", "stock", "type", "date_stock"]).optional().default("date"),
        searchTerm: z.string().optional(),
        stockId: z.number().optional(),
        type: z.enum(["BUY", "SELL", "DIVIDEND"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      let query = db
        .select({
          id: transactions.id,
          stockId: transactions.stockId,
          type: transactions.type,
          date: transactions.date,
          quantity: transactions.quantity,
          totalAmount: transactions.totalAmount,
          unitPrice: transactions.unitPrice,
          notes: transactions.notes,
          createdAt: transactions.createdAt,
          stockSymbol: stocks.symbol,
          stockName: stocks.name,
        })
        .from(transactions)
        .leftJoin(stocks, eq(transactions.stockId, stocks.id))
        .where(eq(transactions.userId, ctx.user.id)) // Scope by user
        .orderBy(desc(transactions.date), desc(transactions.createdAt));

      // Append filters logic...
      // Since I can't chain `.where` easily on existing query object without careful typing, 
      // I will reconstruct basic query logic or filter in memory? No, filter in DB.

      const conditions = [eq(transactions.userId, ctx.user.id)];

      if (input.stockId) {
        conditions.push(eq(transactions.stockId, input.stockId));
      }
      if (input.type) {
        conditions.push(eq(transactions.type, input.type));
      }
      if (input.searchTerm) {
        conditions.push(
          or(
            like(stocks.symbol, `%${input.searchTerm}%`),
            like(stocks.name, `%${input.searchTerm}%`),
            like(transactions.notes, `%${input.searchTerm}%`)
          )!
        );
      }

      // Re-query with conditions
      query = db
        .select({
          id: transactions.id,
          stockId: transactions.stockId,
          type: transactions.type,
          date: transactions.date,
          quantity: transactions.quantity,
          totalAmount: transactions.totalAmount,
          unitPrice: transactions.unitPrice,
          notes: transactions.notes,
          createdAt: transactions.createdAt,
          stockSymbol: stocks.symbol,
          stockName: stocks.name,
        })
        .from(transactions)
        .leftJoin(stocks, eq(transactions.stockId, stocks.id))
        .where(and(...conditions))
        .orderBy(desc(transactions.date), desc(transactions.createdAt)) as any;

      const allTransactions = await query;

      if (input.groupBy === "none") {
        return [{ transactions: allTransactions }];
      }

      const grouped: Record<string, any[]> = {};

      for (const txn of allTransactions) {
        let key = "";
        if (input.groupBy === "date") {
          key = txn.date.toString();
        } else if (input.groupBy === "stock") {
          key = txn.stockSymbol || `Unknown-${txn.stockId}`;
        } else if (input.groupBy === "type") {
          key = txn.type;
        } else if (input.groupBy === "date_stock") {
          key = `${txn.date.toString()}_${txn.stockSymbol || txn.stockId}`;
        }

        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(txn);
      }

      return Object.entries(grouped).map(([key, txns]) => {
        const firstTxn = txns[0];
        const result: any = {
          transactions: txns,
        };

        if (input.groupBy === "date" || input.groupBy === "date_stock") {
          result.date = firstTxn.date;
        }
        if (input.groupBy === "stock" || input.groupBy === "date_stock") {
          result.stockSymbol = firstTxn.stockSymbol;
          result.stockId = firstTxn.stockId;
        }
        if (input.groupBy === "type") {
          result.type = firstTxn.type;
        }

        return result;
      });
    }),
});

