import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routes/index.js";
import { createContext } from "../server/_core/context.js";
import { registerOAuthRoutes } from "../server/_core/oauth.js";
import { ensureTablesExist } from "../server/_core/db-setup.js";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

if (process.env.OAUTH_SERVER_URL) {
  registerOAuthRoutes(app);
}

let dbSetupPromise: Promise<void> | null = null;
app.use(async (req, res, next) => {
  if (!dbSetupPromise) {
    dbSetupPromise = ensureTablesExist().catch(error => {
      console.error("[DB Setup]", error);
    });
  }
  await dbSetupPromise;
  next();
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

export default app;
