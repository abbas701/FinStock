import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // For single-user mode (OAuth not configured), auto-create a default user
  if (!user && !process.env.OAUTH_SERVER_URL) {
    const { upsertUser, getUserByOpenId } = await import("../db");
    const DEFAULT_USER_OPENID = "single-user-default";
    
    try {
      // Create or get the default user
      await upsertUser({
        openId: DEFAULT_USER_OPENID,
        name: "Portfolio Owner",
        role: "admin",
        lastSignedIn: new Date(),
      });
      user = await getUserByOpenId(DEFAULT_USER_OPENID);
    } catch (error) {
      console.warn("[Auth] Failed to create default user:", error);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
