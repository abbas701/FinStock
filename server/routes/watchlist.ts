import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getWatchlist, addToWatchlist, removeFromWatchlist, getStockById } from "../db";
import { getMarketPrice } from "../market";

export const watchlistRouter = router({
  /**
   * Get watchlist
   */
  list: protectedProcedure.query(async () => {
    const items = await getWatchlist();

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

