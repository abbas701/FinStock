import { router } from "../_core/trpc";
import { stockRouter } from "./stock";
import { transactionRouter } from "./transaction";
import { watchlistRouter } from "./watchlist";
import { reportsRouter } from "./reports";
import { authRouter } from "./auth";
import { importRouter } from "./import";
import { settingsRouter } from "./settings";

/**
 * Main App Router
 */
export const appRouter = router({
  auth: authRouter,
  stock: stockRouter,
  transaction: transactionRouter,
  watchlist: watchlistRouter,
  reports: reportsRouter,
  import: importRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;

