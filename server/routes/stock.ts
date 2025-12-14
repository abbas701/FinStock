import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getStockById, getStockBySymbol, getStockAggregates, getTransactionsByStockId, createStock, getAllStocks } from "../db";
import { getMarketPrice } from "../market";

export const stockRouter = router({
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
          currentPrice = priceData.price > 0 ? priceData.price : 0;
        } catch (error) {
          console.error(`Failed to fetch price for ${stock.symbol}:`, error);
          currentPrice = 0;
        }

        const avgCost = aggregate ? parseFloat(aggregate.avgCost) : 0;
        const totalShares = aggregate ? parseFloat(aggregate.totalShares) : 0;
        const unrealizedProfit = aggregate && currentPrice > 0 && avgCost > 0 && totalShares > 0
          ? (currentPrice - avgCost) * totalShares
          : 0;

        const gainLossPercent = aggregate && currentPrice > 0 && avgCost > 0
          ? ((currentPrice - avgCost) / avgCost) * 100
          : 0;

        const totalInvested = aggregate ? parseFloat(aggregate.totalInvested) : 0;
        const realizedProfit = aggregate ? parseFloat(aggregate.realizedProfit) : 0;

        return {
          id: stock.id,
          symbol: stock.symbol,
          name: stock.name,
          totalShares: aggregate ? parseFloat(aggregate.totalShares) : 0,
          avgCost: aggregate?.avgCost || "0",
          totalInvested,
          currentPrice,
          unrealizedProfit,
          realizedProfit,
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

      const avgCost = aggregate ? parseFloat(aggregate.avgCost) : 0;
      const totalShares = aggregate ? parseFloat(aggregate.totalShares) : 0;
      const unrealizedProfit = aggregate && currentPrice > 0 && avgCost > 0 && totalShares > 0
        ? (currentPrice - avgCost) * totalShares
        : 0;

      const gainLossPercent = aggregate && currentPrice > 0 && avgCost > 0
        ? ((currentPrice - avgCost) / avgCost) * 100
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

