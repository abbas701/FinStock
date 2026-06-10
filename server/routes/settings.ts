import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getUserSettings, upsertUserSettings } from "../db";

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getUserSettings(ctx.user.id);
    return {
      tradingWindowDays: settings?.tradingWindowDays ?? 1,
    };
  }),

  setTradingWindow: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(7) }))
    .mutation(async ({ input, ctx }) => {
      await upsertUserSettings(ctx.user.id, { tradingWindowDays: input.days });
      return { tradingWindowDays: input.days };
    }),
});
