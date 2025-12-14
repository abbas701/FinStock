import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { eq, and, gte, lte, sql, desc, asc, inArray } from "drizzle-orm";
import { getDb, getStockById } from "../db";
import { transactions, stocks, stockAggregates } from "../../drizzle/schema";
import Decimal from "decimal.js";
import { processTransaction } from "../db";

export const reportsRouter = router({
  /**
   * Get daywise profit data
   */
  daywise: protectedProcedure
    .input(z.object({ from: z.date(), to: z.date(), stockId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Get all transactions up to the end date, ordered chronologically
      const allTxns = await db
        .select()
        .from(transactions)
        .where(
          and(
            lte(transactions.date, input.to.toISOString().split("T")[0]),
            input.stockId ? eq(transactions.stockId, input.stockId) : undefined
          )
        )
        .orderBy(asc(transactions.date), asc(transactions.createdAt));

      // Replay transactions to calculate accurate profit per day
      const stockStates: Record<number, {
        totalShares: Decimal;
        totalInvested: Decimal;
        avgCost: Decimal;
      }> = {};
      const profitByDate: Record<string, { profit: number; losses: any[] }> = {};

      for (const txn of allTxns) {
        if (!stockStates[txn.stockId]) {
          stockStates[txn.stockId] = {
            totalShares: new Decimal(0),
            totalInvested: new Decimal(0),
            avgCost: new Decimal(0),
          };
        }

        const state = stockStates[txn.stockId];
        const date = txn.date.toString();
        const isInRange = txn.date >= input.from.toISOString().split("T")[0] && txn.date <= input.to.toISOString().split("T")[0];

        if (txn.type === "SELL" && txn.quantity && isInRange) {
          const qty = new Decimal(txn.quantity.toString());
          const proceeds = new Decimal(txn.totalAmount.toString());
          const costBasis = state.avgCost.times(qty);
          const profit = proceeds.minus(costBasis);
          const profitValue = parseFloat(profit.toString());

          if (!profitByDate[date]) {
            profitByDate[date] = { profit: 0, losses: [] };
          }
          profitByDate[date].profit += profitValue;

          if (profitValue < 0) {
            const stock = await getStockById(txn.stockId);
            profitByDate[date].losses.push({
              stockId: txn.stockId,
              stockSymbol: stock?.symbol || "Unknown",
              quantity: parseFloat(qty.toString()),
              unitPrice: parseFloat(proceeds.dividedBy(qty).toString()),
              avgCost: parseFloat(state.avgCost.toString()),
              totalAmount: parseFloat(proceeds.toString()),
              loss: profitValue,
            });
          }
        } else if (txn.type === "DIVIDEND" && isInRange) {
          const dividendAmount = parseFloat(txn.totalAmount.toString());
          if (!profitByDate[date]) {
            profitByDate[date] = { profit: 0, losses: [] };
          }
          profitByDate[date].profit += dividendAmount;
        }

        // Update state for next transaction (replay)
        const currentState = {
          totalShares: state.totalShares,
          totalInvested: state.totalInvested,
          avgCost: state.avgCost,
          realizedProfit: new Decimal(0),
        };
        const newState = processTransaction(currentState, txn);
        stockStates[txn.stockId] = {
          totalShares: newState.totalShares,
          totalInvested: newState.totalInvested,
          avgCost: newState.avgCost,
        };
      }

      return Object.entries(profitByDate)
        .map(([date, data]) => ({
          date,
          profit: data.profit,
          losses: data.losses,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }),

  /**
   * Get stock performance data
   */
  stockPerformance: protectedProcedure
    .input(z.object({ stockIds: z.array(z.number()).optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let query = db
        .select({
          stockId: stocks.id,
          symbol: stocks.symbol,
          name: stocks.name,
          totalShares: stockAggregates.totalShares,
          totalInvested: stockAggregates.totalInvested,
          avgCost: stockAggregates.avgCost,
          realizedProfit: stockAggregates.realizedProfit,
        })
        .from(stocks)
        .leftJoin(stockAggregates, eq(stocks.id, stockAggregates.stockId));

      if (input.stockIds && input.stockIds.length > 0) {
        query = query.where(inArray(stocks.id, input.stockIds)) as any;
      }

      const result = await query;
      return result.map((r) => ({
        stockId: r.stockId,
        symbol: r.symbol,
        name: r.name,
        totalShares: parseFloat(r.totalShares?.toString() || "0"),
        totalInvested: parseFloat(r.totalInvested?.toString() || "0"),
        avgCost: parseFloat(r.avgCost?.toString() || "0"),
        realizedProfit: parseFloat(r.realizedProfit?.toString() || "0"),
        currentPrice: 0,
      }));
    }),

  /**
   * Get transaction volume over time
   */
  transactionVolume: protectedProcedure
    .input(z.object({ from: z.date(), to: z.date(), type: z.enum(["BUY", "SELL", "DIVIDEND"]).optional(), stockId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const result = await db
        .select({
          date: transactions.date,
          type: transactions.type,
          totalAmount: transactions.totalAmount,
          quantity: transactions.quantity,
          symbol: stocks.symbol,
        })
        .from(transactions)
        .leftJoin(stocks, eq(transactions.stockId, stocks.id))
        .where(
          and(
            gte(transactions.date, input.from.toISOString().split("T")[0]),
            lte(transactions.date, input.to.toISOString().split("T")[0]),
            input.type ? eq(transactions.type, input.type) : undefined,
            input.stockId ? eq(transactions.stockId, input.stockId) : undefined
          )
        )
        .orderBy(transactions.date);

      return result.map((r) => ({
        date: r.date.toString(),
        type: r.type,
        totalAmount: parseFloat(r.totalAmount.toString()),
        quantity: r.quantity ? parseFloat(r.quantity.toString()) : null,
        symbol: r.symbol || "",
      }));
    }),

  /**
   * Get portfolio distribution
   */
  portfolioDistribution: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const result = await db
      .select({
        stockId: stocks.id,
        symbol: stocks.symbol,
        name: stocks.name,
        totalInvested: stockAggregates.totalInvested,
        totalShares: stockAggregates.totalShares,
      })
      .from(stocks)
      .leftJoin(stockAggregates, eq(stocks.id, stockAggregates.stockId))
      .where(sql`${stockAggregates.totalShares}::numeric > 0`);

    return result.map((r) => ({
      stockId: r.stockId,
      symbol: r.symbol,
      name: r.name,
      totalInvested: parseFloat(r.totalInvested?.toString() || "0"),
      totalShares: parseFloat(r.totalShares?.toString() || "0"),
    }));
  }),
});

