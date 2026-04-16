# Stock Portfolio Tracker

A complete, production-quality single-user stock portfolio tracker built with Next.js, Express, PostgreSQL, and moving-average accounting. Track your stock investments with precise cost basis calculations, real-time market prices, and comprehensive reporting.

## Overview

The Stock Portfolio Tracker implements the **moving-average (average cost) accounting method** for portfolio management. This approach calculates the average cost per share as you buy and sell, providing accurate profit/loss calculations that reflect your actual investment performance.

**Key Features:**

- **Moving-Average Accounting**: Precise cost basis tracking with automatic aggregate recomputation
- **Multi-Transaction Types**: Support for BUY, SELL, and DIVIDEND transactions
- **Real-Time Market Prices**: Integration with free market data providers (Yahoo Finance, Alpha Vantage)
- **Portfolio Dashboard**: Comprehensive overview of holdings with profit/loss metrics
- **Transaction Management**: Add, edit, and delete transactions with automatic recalculation
- **Watchlist**: Monitor stocks you're interested in
- **Reports**: Daywise profit analysis and performance tracking
- **Responsive Design**: Mobile-first interface optimized for all devices
- **Simple Node Deployment**: Run as a standard Node.js service

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js (React 19) + Tailwind CSS 4 |
| Backend | Express.js + tRPC |
| Database | PostgreSQL + Drizzle ORM |
| Accounting | Decimal.js for precise calculations |
| Charts | Nivo (planned) |
| Testing | Vitest |
| Deployment | Node.js runtime (Vercel/Netlify/other) |

## Project Structure

```
stock-portfolio-tracker/
├── client/                    # Next.js frontend
│   ├── src/
│   │   ├── pages/            # Page components (Home, Entry, etc.)
│   │   ├── components/       # Reusable UI components
│   │   ├── lib/              # Utilities and helpers
│   │   └── App.tsx           # Main router
│   └── public/               # Static assets
├── server/                    # Express backend
│   ├── db.ts                 # Database queries and accounting logic
│   ├── market.ts             # Market data adapter
│   ├── routers.ts            # tRPC procedure definitions
│   ├── __tests__/            # Unit tests
│   └── _core/                # Framework plumbing
├── drizzle/                  # Database schema and migrations
├── scripts/                  # Seed and utility scripts
└── README.md                 # This file
```

## Getting Started

### Prerequisites

- **Node.js** 22+ and **pnpm** 10+
- **PostgreSQL** 14+
- **Git**

### Local Development

1. **Clone and install dependencies:**

```bash
git clone <repository-url>
cd stock-portfolio-tracker
pnpm install
```

2. **Set up the database:**

Create a PostgreSQL database and update your `.env` file:

```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Run migrations:**

```bash
pnpm db:push
```

4. **Seed example data (optional):**

```bash
pnpm seed
```

5. **Start the development server:**

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

## Environment Variables

Create a `.env` file in the project root with the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase pooler recommended for hosted runtimes) | `postgresql://postgres.<ref>:<password>@<pooler-host>:6543/postgres?sslmode=require` |
| `COOKIE_SECRET` | Secret used for session signing (required in production) | `long-random-secret` |
| `APP_BASE_URL` | Public URL of the deployed app (used for reset links) | `https://your-app-domain.com` |
| `MARKET_API_PROVIDER` | Market data provider (yahoo_finance2 or alpha_vantage) | `yahoo_finance2` |
| `MARKET_API_KEY` | API key for Alpha Vantage (only if using alpha_vantage) | (optional) |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (development or production) | `development` |
| `VITE_APP_TITLE` | Frontend app title override | `Stock Portfolio Tracker` |
| `VITE_APP_ID` | Frontend app identifier (used with OAuth portal flow) | `stock-portfolio-tracker` |
| `VITE_OAUTH_PORTAL_URL` | OAuth portal URL (optional) | `https://auth.example.com` |

## Database Schema

### Tables

**stocks** - Stock master data

```sql
id (int, PK)
symbol (varchar, unique)
name (varchar)
createdAt (timestamp)
```

**transactions** - Buy, sell, and dividend transactions

```sql
id (int, PK)
stockId (int, FK)
type (enum: BUY, SELL, DIVIDEND)
date (date)
quantity (decimal, nullable for DIVIDEND)
totalAmount (decimal, in PKR)
unitPrice (decimal, computed)
notes (text)
createdAt (timestamp)
updatedAt (timestamp)
```

**stockAggregates** - Cached aggregates for performance

```sql
id (int, PK)
stockId (int, FK, unique)
totalShares (decimal)
totalInvested (decimal, in PKR)
avgCost (decimal, in PKR per share)
realizedProfit (decimal, in PKR)
updatedAt (timestamp)
```

**watchlist** - User's watchlist

```sql
id (int, PK)
stockId (int, FK)
addedAt (timestamp)
```

## Accounting Logic

### Moving-Average Method

The application implements the **moving-average (average cost)** method for portfolio accounting. This method calculates the average cost per share as you accumulate positions, and uses this average to determine profit/loss on sales.

#### BUY Transaction

When you buy shares:

```
new_total_shares = total_shares + quantity
new_total_invested = total_invested + totalAmount
new_avg_cost = new_total_invested / new_total_shares
```

#### SELL Transaction

When you sell shares:

```
proceeds = quantity × sell_unit_price
cost_removed = avg_cost × quantity
realized_profit = proceeds - cost_removed
new_total_shares = total_shares - quantity
new_total_invested = total_invested - cost_removed
new_avg_cost = new_total_invested / new_total_shares (or 0 if shares = 0)
```

**Important:** The `cost_removed` is calculated using the current average cost, not the actual purchase price. This is the fundamental principle of the moving-average method.

#### DIVIDEND Transaction

Dividends add directly to realized profit without affecting share count or invested amount:

```
realized_profit += dividend_amount
```

#### Edit/Delete Transactions

When you edit or delete a transaction, the system replays all transactions for that stock in chronological order to guarantee correct state. This ensures that historical changes propagate correctly through subsequent transactions.

### Example: KEL (Kisan Electric)

Here's a complete example demonstrating the moving-average method:

| Date | Type | Qty | Price/Share | Total | Avg Cost | Total Shares | Total Invested | Realized Profit |
|------|------|-----|-------------|-------|----------|--------------|----------------|-----------------|
| 2024-01-01 | BUY | 100 | 500 | 50,000 | 500 | 100 | 50,000 | 0 |
| 2024-01-15 | BUY | 50 | 600 | 30,000 | 533.33 | 150 | 80,000 | 0 |
| 2024-02-01 | SELL | 75 | 700 | 52,500 | 533.33 | 75 | 40,000 | 12,500 |
| 2024-03-01 | DIV | - | - | 500 | 533.33 | 75 | 40,000 | 13,000 |

**Calculation for SELL transaction:**
- Proceeds: 75 × 700 = 52,500 PKR
- Cost removed: 75 × 533.33 = 40,000 PKR
- Realized profit: 52,500 - 40,000 = 12,500 PKR

## API Endpoints

All endpoints are implemented via tRPC and accessible at `/api/trpc`.

### Stock Management

- **`stock.create`** - Create a new stock
- **`stock.list`** - List all stocks with aggregated stats
- **`stock.getDetail`** - Get stock detail with transactions

### Transaction Management

- **`transaction.add`** - Add a transaction (BUY/SELL/DIVIDEND)
- **`transaction.update`** - Edit a transaction
- **`transaction.delete`** - Delete a transaction

### Watchlist Management

- **`watchlist.list`** - Get watchlist
- **`watchlist.add`** - Add to watchlist
- **`watchlist.remove`** - Remove from watchlist

### Market Data

- **`market.getPrice`** - Get current market price for a stock

### Reports

- **`reports.daywise`** - Get daywise profit data for a date range

## Market Data Providers

The application supports multiple market data providers with automatic fallback and caching.

### Default Provider: Yahoo Finance (Free)

The default provider uses Yahoo Finance's unofficial API, which requires no API key and has no rate limits for personal use.

**Advantages:**
- No API key required
- No rate limits
- Covers most stocks globally

**Limitations:**
- Unofficial API (may change without notice)
- Slight delays in price updates

### Alternative Provider: Alpha Vantage

For more reliable data, you can use Alpha Vantage, which offers free and paid plans.

**To use Alpha Vantage:**

1. Get a free API key from [Alpha Vantage](https://www.alphavantage.co/api/)
2. Set environment variables:

```bash
MARKET_API_PROVIDER=alpha_vantage
MARKET_API_KEY=your_api_key_here
```

3. Restart the application

**Advantages:**
- Official, reliable API
- Consistent data quality
- Multiple data types available

**Limitations:**
- Free tier: 5 requests per minute, 500 per day
- Paid tier available for higher limits

### Price Caching

The application caches market prices for 60 seconds to reduce API calls. This is transparent to the user and can be adjusted in `server/market.ts`.

## Testing

Run unit tests for accounting logic:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

Tests cover:
- Moving-average calculations
- Buy/sell/dividend transactions
- Profit/loss calculations
- Edge cases (selling all shares, decimal quantities)
- The KEL example from requirements

## Deployment

### Can this run fully on Railway (frontend + backend + DB)?

Yes. This repository can run as a single Railway service:
- Frontend: Vite build output is served by Express in production.
- Backend: Express + tRPC runs in the same service.
- Database: Use Supabase Postgres via `DATABASE_URL`.

Railway free resources can be enough for development/small personal usage, but free limits can change and may sleep/scale down on inactivity. For reliable uptime, monitor your Railway plan limits.

### Railway (Single Service) Deployment

If you want to deploy the whole repo directly to Railway, use this setup:

1. Create a new Railway project and connect this repository.
2. Railway will use `railway.json` in this repo:
	- Build: `pnpm install --frozen-lockfile && pnpm build`
	- Start: `pnpm start`
3. Configure environment variables in Railway:
	- `NODE_ENV=production`
	- `DATABASE_URL=<supabase-pooler-url-with-sslmode=require>`
	- `COOKIE_SECRET=<long-random-secret>`
	- `APP_BASE_URL=https://<your-railway-domain>` (optional if `RAILWAY_PUBLIC_DOMAIN` is available)
	- `MARKET_API_PROVIDER=yahoo_finance2` (or your provider)
	- `MARKET_API_KEY` (only if using `alpha_vantage`)
4. Deploy.

For this single-service Railway setup, keep `VITE_API_BASE_URL` empty so the frontend calls same-origin `/api/trpc`.

### Vercel vs Netlify for this codebase

This app currently runs as a single Node/Express runtime (tRPC API + static client served by Express), not as a pure static frontend with separate serverless handlers.

**Vercel - Pros**
- Better Node.js runtime ergonomics and observability for TypeScript/Express-heavy apps.
- Strong Git integration and preview deploy workflow.
- Cleaner DX for projects that may later split frontend and API.

**Vercel - Cons**
- Serverless model can create more frequent cold starts on low traffic.
- You must use pooled Postgres connections (Supabase pooler) to avoid connection exhaustion.

**Netlify - Pros**
- Excellent static frontend hosting and CDN behavior.
- Good branch previews and simple UI for environment variables.

**Netlify - Cons**
- This architecture needs more adaptation effort to fit Netlify Functions cleanly.
- Express-first backends are generally less straightforward than on Vercel.

### Recommendation

Use **Vercel** for this project if your requirement is choosing between Vercel and Netlify while keeping current logic flow intact. It is the lower-friction path for your existing Node + Express + tRPC setup.

### Frontend Deployment on Vercel

If you want to deploy **frontend only** on Vercel, keep backend/API on your server and point the frontend to it.

1. Import the repository in Vercel.
2. Keep root directory as project root.
3. Build settings are provided via `vercel.json`:
	- Install command: `pnpm install --frozen-lockfile`
	- Build command: `pnpm vite build`
	- Output directory: `dist/public`
4. Add environment variables in Vercel project settings:
	- `VITE_API_BASE_URL=https://your-backend-domain.com`
	- `VITE_APP_TITLE` (optional)
	- `VITE_APP_ID` / `VITE_OAUTH_PORTAL_URL` (if OAuth flow is enabled)
5. Deploy.

The frontend will call `${VITE_API_BASE_URL}/api/trpc` in production. If `VITE_API_BASE_URL` is empty, it falls back to same-origin `/api/trpc`.

### Live configuration with Supabase (recommended baseline)

1. Create a Supabase project.
2. Copy the **pooler** Postgres URL from Supabase.
3. Set `DATABASE_URL` to the pooler URL with `sslmode=require`.
4. Set `COOKIE_SECRET` to a long random value.
5. Set `APP_BASE_URL` to your deployed HTTPS domain.
6. Set `NODE_ENV=production`.
7. Optionally set `MARKET_API_PROVIDER` and `MARKET_API_KEY`.

Use `.env.production.example` as your source-of-truth template for live variables.

## Troubleshooting

### Database Connection Issues

**Problem:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution:**
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env`

### Market Price Fetch Failures

**Problem:** `Failed to fetch price for SYMBOL`

**Solution:**
- Check internet connection
- Verify stock symbol is correct
- Check rate limits (especially for Alpha Vantage free tier)
- Switch to Yahoo Finance provider

### Transaction Calculation Errors

**Problem:** Profit calculations seem incorrect

**Solution:**
- Ensure all amounts are in PKR (not paise)
- Check transaction dates are in correct order
- Try deleting and re-adding the transaction
- Check database for data consistency

## Converting to FIFO Method

The application currently uses moving-average accounting. To convert to FIFO (First-In-First-Out):

1. Modify `processTransaction()` in `server/db.ts`
2. Implement FIFO queue tracking instead of average cost
3. Update tests to reflect FIFO calculations
4. Recompute all aggregates with new method

See `server/db.ts` for detailed comments on where to make changes.

## Extending to Multi-User

The application is designed for single-user use but can be extended to multi-user:

1. Uncomment `User` model in `drizzle/schema.ts`
2. Add `userId` foreign key to `stocks`, `transactions`, and `watchlist` tables
3. Update all queries to filter by `ctx.user.id`
4. Implement proper authentication and authorization
5. Add user management endpoints

## Contributing

Contributions are welcome! Please ensure:

- Code follows the existing style
- All tests pass: `pnpm test`
- Database migrations are included for schema changes
- Comments explain complex accounting logic

## License

MIT

## Support

For issues, questions, or suggestions, please open an issue on GitHub or contact the development team.

## Changelog

### Version 1.0.0 (Initial Release)

- Complete moving-average accounting implementation
- Full CRUD operations for stocks and transactions
- Real-time market price integration
- Portfolio dashboard with profit/loss metrics
- Responsive UI with Tailwind CSS
- Comprehensive test suite
- Production-ready codebase

---

**Built with ❤️ by the Stock Portfolio Tracker team**

Last updated: November 2024
