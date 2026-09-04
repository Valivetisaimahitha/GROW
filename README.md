# PulseWatch: Smart Market Watchlist

## The Problem
Traditional market watchlists are static snapshots. When you return to your trading app after hours or days, you see the current price, but you have no context of how that relates to what you last saw. Did it spike 5% yesterday and drop 2% today? Traditional apps leave you guessing.

## Product Thesis & 100-Word Pitch
**PulseWatch remembers what you saw and tells you what meaningfully changed while you were away.** 
Instead of bombarding you with real-time noise, PulseWatch establishes a **Personal Baseline** the moment you look at a stock. When you return, our deterministic **Attention Engine** evaluates the divergence between your personal memory, today's market movement, and the stock's historical volatility. It scores these changes against a strict **Attention Budget**, surfacing only the most critical movements in a clean, chronological **Change Journal**. It’s not just a watchlist; it’s an asynchronous market intelligence system that respects your time and attention.

## Key Concepts
- **Personal Market Memory**: The system remembers the exact price and timestamp you last observed for every security.
- **Three-Baseline Model**: Changes are evaluated against your Personal Baseline, Today's Baseline, and a Historical/Behavioral Baseline (volatility & volume).
- **Attention Engine**: Pure, deterministic domain logic that scores changes (0-100) based on meaningfulness. (Zero Math.random() usage).
- **Attention vs Confidence**: The severity of a move (Attention) is strictly decoupled from data freshness (Confidence). Stale data lowers confidence without falsely triggering attention.
- **Attention Budget**: Prominent UI cards are capped (max 3-5) to prevent overwhelming the user.

## Architecture & Technology Stack
- **Framework**: Next.js 14 App Router
- **Database**: **SQLite** (Development/Competition build) via Prisma ORM for reproducible judging.
- **Authentication**: JWT-based Server-Side Sessions (using `jose`).
- **Data Provider**: Abstracted `MarketDataProvider`. The competition build uses a deterministic `DemoProvider` to ensure judges can evaluate resilience and logic reproducibly. 

## Resilience & Edge Cases Addressed
- **First Visit**: Establishes baseline without fabricating false "+4%" changes.
- **Long Absence**: Distinctly separates "Since you last checked" from "Today's movement".
- **Rapid Return**: Prevents noisy events if the user refreshes seconds later.
- **Stale Data & Provider Failures**: Graceful degradation to "Last Trusted State". A partial failure of 1 stock won't break the dashboard of 20 stocks.
- **Idempotency**: Prevents duplicate `ChangeEvents` on rapid refreshes.

## Testing & Verification
PulseWatch includes extensive Vitest suites testing Domain Logic, Authentication, Authorization (Ownership), and Observation Lifecycles.
```bash
# Run tests
npm test
```
**Test Coverage Includes:**
- 401s for missing auth, 403s for unauthorized watchlist access.
- Demo mode lockdown when `DEMO_MODE=false`.
- ChangeEvent determinism and idempotency.
- Proper fallback to `HISTORICAL_DATA_UNAVAILABLE` (never fabricating volatility).

## Setup & Running the Application

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file based on `.env.example`:
   ```env
   DEMO_MODE=true
   SESSION_SECRET="your-secure-secret-key"
   ```

3. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma db push
   # Note: Uses local SQLite dev.db
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Demo Presentation Guide (For Judges)
Ensure `DEMO_MODE=true` in your `.env`.
1. **Initial Visit**: Add INFY to watchlist to establish a baseline.
2. **Trigger Significant Move**: Use the bottom Demo Control Bar to set the scenario to `SIGNIFICANT_SINGLE_MOVE`.
3. **Return**: The dashboard will explicitly highlight the divergence since your last check.
4. **Why am I seeing this?**: Expand the card to see the deterministic reasons (Unusualness factor, volume anomaly).
5. **Resilience**: Switch scenario to `PROVIDER_FAILURE` to see the graceful UI degradation.
6. **Divergence Demo**: Observe the differing changes when switching between Demo User A and Demo User B on the same current market state.

## Known Limitations
- The competition build uses `DemoProvider` rather than live NSE data for reproducibility.
- Login flow is currently bypassed for the demo, using direct HTTP-only cookie setting without a frontend password form.

PulseWatch is built to be a robust, competition-grade demonstration of asynchronous product engineering.
