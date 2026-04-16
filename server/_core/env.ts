const DEFAULT_COOKIE_SECRET = "default-secret-do-not-use-in-production";

const isProduction = process.env.NODE_ENV === "production";
const cookieSecret =
  process.env.JWT_SECRET || process.env.COOKIE_SECRET || DEFAULT_COOKIE_SECRET;
const databaseUrl = process.env.DATABASE_URL ?? "";
const appBaseUrl =
  process.env.APP_BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "");

if (isProduction && !databaseUrl) {
  throw new Error("DATABASE_URL is required in production");
}

if (isProduction && cookieSecret === DEFAULT_COOKIE_SECRET) {
  throw new Error("COOKIE_SECRET (or JWT_SECRET) must be set in production");
}

if (isProduction && !appBaseUrl) {
  throw new Error(
    "APP_BASE_URL is required in production unless RAILWAY_PUBLIC_DOMAIN is available"
  );
}

export const ENV = {
  appId: process.env.VITE_APP_ID || "stock-portfolio-tracker",
  cookieSecret,
  databaseUrl,
  appBaseUrl,
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
