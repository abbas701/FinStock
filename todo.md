# Stock Portfolio Tracker - TODO

## Database & Schema
- [x] Update Drizzle schema with Stock, Transaction, Watchlist models
- [x] Add User model (optional, for future multi-user support)
- [x] Configure PostgreSQL with proper indexes on symbol and stockId
- [x] Run database migrations

## Backend - Accounting Logic
- [x] Implement moving-average accounting functions (buy, sell, dividend)
- [x] Create aggregate computation logic for stocks
- [x] Implement transaction replay for edit/delete operations
- [ ] Add server-side validations for sell operations

## Backend - API Endpoints
- [x] POST /api/stocks - create stock
- [x] GET /api/stocks - list stocks with aggregated stats
- [x] GET /api/stocks/:id - stock detail with transactions
- [x] POST /api/stocks/:id/transactions - add transaction
- [x] PUT /api/transactions/:id - edit transaction
- [x] DELETE /api/transactions/:id - delete transaction
- [x] GET /api/watchlist - list watchlist
- [x] POST /api/watchlist - add to watchlist
- [x] DELETE /api/watchlist/:id - remove from watchlist
- [x] GET /api/market/:symbol/price - market price adapter
- [x] GET /api/reports/daywise - daywise profit data

## Backend - Market Data
- [x] Implement market adapter pattern (default: yahoo_unofficial)
- [x] Add Alpha Vantage adapter with MARKET_API_KEY support
- [x] Implement server-side price caching (60s TTL)
- [ ] Document provider swap in README

## Testing
- [x] Write unit tests for moving-average accounting
- [x] Test buy transaction calculations
- [x] Test sell transaction calculations (with KEL example)
- [x] Test dividend transaction handling
- [x] Test sell override validation
- [x] Create test command (npm run test)

## Frontend - Pages & Components
- [x] Create Home page with portfolio table
- [x] Create Entry page (transaction form)
- [x] Create Watchlist page
- [x] Create Stock Detail page
- [x] Create Reports page with date range controls
- [x] Implement responsive design (mobile-first)

## Frontend - Features
- [ ] Autocomplete stock selector in Entry form
- [ ] Real-time per-share price calculation
- [ ] Client-side validation and warnings
- [ ] Confirmation modals for sell operations
- [ ] Toast notifications for success/failure
- [ ] PWA manifest and service worker
- [ ] Responsive tables and charts

## Frontend - Charts (Nivo)
- [ ] Line chart: daywise profit earnings
- [ ] Bar chart: stock vs % gain/loss
- [ ] Bar chart: total profit per stock
- [ ] Date range selector for charts

## DevOps & Deployment
- [x] Create Dockerfile for backend
- [x] Create Dockerfile for frontend
- [x] Create docker-compose.yml
- [x] Add .env.example with all required variables
- [ ] Document local dev setup
- [ ] Document Docker commands
- [ ] Add deployment notes for Render/Railway/Vercel

## Seed Data
- [x] Create seed script with ~20 example stocks
- [x] Add sample transactions (buys, sells, dividends)
- [x] Include KEL example for verification
- [x] Create npm run seed command

## Documentation
- [x] Write comprehensive README
- [x] Document .env variables and timezone (PKT/UTC+5)
- [x] Document accounting method (moving-average)
- [x] Document market provider swap
- [x] Document how to convert to FIFO
- [x] Add troubleshooting section
- [x] Document rate limits and caveats

## Quality & Polish
- [x] Code organization and comments
- [x] Inline comments for accounting logic
- [x] Error handling and validation
- [x] Performance optimization (pagination, indexes)
- [x] Accessibility review
- [x] Cross-browser testing
