export const ENV = {
  appId: process.env.VITE_APP_ID || "stock-portfolio-tracker",
  cookieSecret: process.env.JWT_SECRET || process.env.COOKIE_SECRET || "default-secret-do-not-use-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
