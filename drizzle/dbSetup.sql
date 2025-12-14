CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('BUY', 'SELL', 'DIVIDEND');--> statement-breakpoint
CREATE TABLE "stockAggregates" IF NOT EXISTS (
	"id" serial PRIMARY KEY NOT NULL,
	"stockId" integer NOT NULL,
	"totalShares" numeric(18, 8) DEFAULT '0' NOT NULL,
	"totalInvested" numeric(18, 2) DEFAULT 0 NOT NULL,
	"avgCost" numeric(18, 8) DEFAULT '0' NOT NULL,
	"realizedProfit" numeric(18, 2) DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stockAggregates_stockId_unique" UNIQUE("stockId")
);
--> statement-breakpoint
CREATE TABLE "stocks" IF NOT EXISTS (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"name" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stocks_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "transactions" IF NOT EXISTS (
	"id" serial PRIMARY KEY NOT NULL,
	"stockId" integer NOT NULL,
	"type" "transaction_type" NOT NULL,
	"date" date NOT NULL,
	"quantity" numeric(18, 8),
	"totalAmount" numeric(18, 2) NOT NULL,
	"unitPrice" numeric(18, 8),
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" IF NOT EXISTS (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "watchlist" IF NOT EXISTS (
	"id" serial PRIMARY KEY NOT NULL,
	"stockId" integer NOT NULL,
	"addedAt" timestamp DEFAULT now() NOT NULL
);
