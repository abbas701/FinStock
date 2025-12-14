import { router, publicProcedure } from "../_core/trpc";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user || null),
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie("session");
    return { success: true };
  }),
});

