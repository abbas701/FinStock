import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { addTransaction, updateTransaction, deleteTransaction, recomputeAggregates, recomputeAllAggregates } from "../db";
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
        totalAmount: z.string(),
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
    .query(async ({ input }) => {
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
        .orderBy(desc(transactions.date), desc(transactions.createdAt));

      const conditions = [];
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

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

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

