-- Migration: Convert amounts from paise (integer) to PKR (decimal)
-- This migration updates the database schema to store amounts in PKR directly
-- instead of paise (PKR * 100), removing the unnecessary multiplication/division

-- Step 1: Update transactions table - change totalAmount from integer to decimal
ALTER TABLE "transactions" ALTER COLUMN "totalAmount" TYPE numeric(18, 2) USING "totalAmount";

-- Step 2: Update transactions table - change quantity to allow NULL for DIVIDEND transactions
ALTER TABLE "transactions" ALTER COLUMN "quantity" DROP NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "quantity" TYPE numeric(18, 8) USING "quantity";

-- Step 3: Update stockAggregates table - change totalInvested from integer to decimal
ALTER TABLE "stockAggregates" ALTER COLUMN "totalInvested" TYPE numeric(18, 2) USING "totalInvested";
ALTER TABLE "stockAggregates" ALTER COLUMN "totalInvested" SET DEFAULT '0';

-- Step 4: Update stockAggregates table - change realizedProfit from integer to decimal  
ALTER TABLE "stockAggregates" ALTER COLUMN "realizedProfit" TYPE numeric(18, 2) USING "realizedProfit";
ALTER TABLE "stockAggregates" ALTER COLUMN "realizedProfit" SET DEFAULT '0';

-- Note: After running this migration, you should recompute all aggregates to ensure data consistency
-- You can do this by calling the recomputeAllAggregates endpoint or running:
-- SELECT recompute_aggregates(stock_id) FROM stocks;
