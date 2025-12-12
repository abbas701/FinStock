# Migration Guide: PKR Currency Handling Updates

## Overview
This document describes the changes made to fix data persistence and currency handling issues in the FinStock application.

## Problems Fixed

### 1. Unnecessary "Paise" Concept
**Problem:** The application was storing amounts as integers in "paise" (PKR * 100), requiring constant multiplication and division by 100 throughout the codebase.

**Solution:** All amounts are now stored directly in PKR as DECIMAL types with appropriate precision.

### 2. Data Persistence Issues
**Problem:** The stockAggregates table could get out of sync with transactions, showing phantom quantities and prices even after transactions were deleted.

**Solution:** Ensured single source of truth with proper recomputation logic. All aggregates are now consistently calculated from transactions.

### 3. Inconsistent Data Types
**Problem:** Mixing integer (paise) and decimal (PKR) types caused confusion and calculation errors.

**Solution:** Standardized on DECIMAL types for all monetary values and quantities.

## Database Schema Changes

### Before:
```sql
transactions.totalAmount: INTEGER  -- in paise (PKR * 100)
stockAggregates.totalInvested: INTEGER  -- in paise
stockAggregates.realizedProfit: INTEGER  -- in paise
stockAggregates.avgCost: DECIMAL  -- in paise (confusing!)
```

### After:
```sql
transactions.totalAmount: DECIMAL(18,2)  -- in PKR
transactions.quantity: DECIMAL(18,8)  -- nullable for dividends
stockAggregates.totalInvested: DECIMAL(18,2)  -- in PKR
stockAggregates.realizedProfit: DECIMAL(18,2)  -- in PKR  
stockAggregates.avgCost: DECIMAL(18,8)  -- in PKR per share
```

## Code Changes Summary

### Backend
- `drizzle/schema.ts`: Updated schema to use DECIMAL for all amounts
- `server/db.ts`: Changed all functions to accept/return PKR strings
- `server/routers.ts`: Removed paise conversions and updated calculations
- `server/market.ts`: Updated to return prices directly in PKR
- `server/__tests__/accounting.test.ts`: Updated all test cases to use PKR

### Frontend
- `client/src/lib/utils.ts`: Removed `parseToPane()` and `paiseToKR()` functions
- `client/src/pages/Entry.tsx`: Removed paise conversion when submitting transactions
- `client/src/pages/Home.tsx`: Updated market value calculations
- `client/src/pages/Stocks.tsx`: Removed price division by 100
- `client/src/pages/StockDetail.tsx`: Updated formatCurrency calls to work with PKR

## Migration Steps

### For Existing Deployments

1. **Backup your database** before proceeding!

2. **Run the migration SQL:**
   ```bash
   psql -U your_user -d your_database -f drizzle/0001_convert_amounts_to_pkr.sql
   ```

3. **Important:** The migration converts data types but does NOT convert existing data values. If you have existing data stored in paise:
   
   **Option A - For test/development databases:**
   - Clear all data and start fresh

   **Option B - For production databases with real data:**
   - Contact support for a data conversion script
   - The script will divide all amount values by 100 to convert from paise to PKR

4. **Recompute all aggregates** after migration:
   ```bash
   # Use the API endpoint or database function
   curl -X POST http://your-app/api/trpc/transaction.recomputeAllAggregates
   ```

### For New Deployments
No special steps needed - just deploy normally.

## Testing

All 10 unit tests pass with the new PKR-based logic:
```bash
npm test
```

Tests cover:
- Moving-average calculations
- Buy/sell/dividend transactions
- Profit/loss calculations
- Edge cases (selling all shares, decimal quantities)

## Breaking Changes

### API Changes
- `transaction.add` input: `totalAmount` is now `string` instead of `number`
- `transaction.update` input: `totalAmount` is now `string` instead of `number`
- All aggregate amounts returned from API are now numbers in PKR (not paise integers)

### Frontend Utilities
- **Removed:** `parseToPane(pkr: number): number`
- **Removed:** `paiseToKR(paise: number): number`
- **Updated:** `formatCurrency(pkr: number | string): string` - now accepts PKR directly

## Benefits

1. **Simplified Code:** Removed ~50+ instances of multiplication/division by 100
2. **Better Precision:** DECIMAL types prevent rounding errors
3. **Clearer Intent:** Code now clearly works with PKR, no confusion
4. **Single Source of Truth:** Database is the only source of persistent data
5. **Easier Maintenance:** Less complex conversions to maintain

## Rollback Plan

If issues arise:
1. Revert to previous git commit
2. Restore database backup
3. Redeploy previous version

Note: Once data is in the new format, reverting code without reverting data will cause issues.

## Support

For questions or issues:
- Check test files for examples of correct usage
- Review the code changes in the PR
- Contact the development team

---
Last updated: 2025-12-12
