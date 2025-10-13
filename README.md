# APXO - Touristic Procurement & Demand Simulation

APXO is a real-time, two-phase simulation for procurement and demand in tourism. Teams first compete in a sealed fixed-seat auction (Phase 1) and then operate in a compressed live market with logit demand and dynamic airline repricing (Phase 2).

---

## Highlights

- **Agent v1 Engine** - Type-safe simulation (`src/lib/simulation/engine.ts`) covering the fixed-seat auction, a 12-15 step countdown, forecast-based airline repricing, attention boosts, and anti-collusion guardrails.
- **Config-Driven Gameplay** - Default scenario lives in `apxo.config.yaml` and can be overridden for workshops or experiments.
- **Practice Mode** - Frontend-only training mode (no backend) that runs the engine for quick demo rounds.
- **Round Evaluation View** - Post-round recap for teams that distills Phase 1 allocations plus Phase 2 market performance while hiding live controls.
- **Streamlined Admin Controls** - Phase control card on the admin dashboard now bundles Start/End Phase buttons with a guarded “Reset Current Game” action for quick recoveries.
- **Airline Guardrails** - Admin-only controls for an auto-calculated fixed-seat share (8 % of aircraft seats per active team), a hard minimum bid aligned with the airline floor, and automatic pooling safety to prevent forced insolvency.
- **Multi-User Lobby** - Socket.IO keeps team registration, admin controls, snapshots, and the leaderboard in sync.
- **UI Toolkit** - Tailwind + shadcn/ui, Storybook, Framer Motion animations, responsive layouts.
- **CI-Ready Tooling** - Jest/Vitest, Playwright, ESLint. Engine-specific tests safeguard the core domain.

---

## Architecture (At a Glance)

| Layer      | Tech & Path                                    | Purpose |
|------------|------------------------------------------------|---------|
| Frontend   | React 19 + Vite (`src/`)                       | UI, real-time views, practice mode |
| Simulation | TS engine (`src/lib/simulation/`)              | Two-phase game rules, config loader |
| Backend    | Node/Express + Socket.IO (`server/`)           | Lobby, admin control, persistence (SQLite/Sequelize) |
| Styling    | Tailwind, shadcn/ui, custom animations         | Components, layout |
| Testing    | Jest, Playwright, Storybook, ESLint            | Quality assurance |

---

## Quickstart

### Prerequisites

- Node.js >= 18
- npm or yarn
- Git

### Installation

```bash
git clone https://github.com/Schnubbione/APXO.git
cd APXO
npm install
cd server && npm install && cd ..
```

### Environment Variables

Frontend (`.env.local`):
```env
VITE_SERVER_URL=http://localhost:3001
```

Backend (`server/.env`):
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ADMIN_PASSWORD=admin123   # local only, replace in production
```

### Start Servers

Terminal 1 - backend:
```bash
cd server
npm run dev   # or npm start
```

Terminal 2 - frontend:
```bash
npm run dev
```

Endpoints:
- Frontend: http://localhost:5173
- Backend health: http://localhost:3001

### Practice Mode (Agent v1)

While the frontend is running, click the "Practice Mode" toggle in the top-right corner to run a full simulation (fixed-seat auction followed by the live countdown) without the backend. It uses `apxo.config.yaml` for configuration.

---

## Simulation Engine

- **Config Loader:** `src/lib/simulation/defaultConfig.ts` loads `apxo.config.yaml` via the `yaml` parser.
- **Interfaces:** `src/lib/simulation/types.ts` defines every data type (bids, decisions, snapshots, final report).
- **Engine:** `src/lib/simulation/engine.ts`
  - `runAuction` - Pay-as-bid, sorted by price, optional budget caps.
  - `runTick` - Logit demand (alpha, beta), attention, tools with cooldown, fixed-before-pooling, airline repricing.
  - `finalize` - Hotel penalty, win condition (profit + price constraint), load factor.
  - Utility helpers for seeded RNG, collusion detection, and price bounds.
- **Demo:** `src/lib/simulation/demo.ts` produces a full timeline and final summary from the default config.

### Engine Tests

```bash
npm test -- --runTestsByPath src/lib/simulation/__tests__/engine.test.ts
```

Covered scenarios:
1. Auction allocates seats pay-as-bid in descending order.
2. Sales drain fixed inventory before pooling.
3. Airline price increases when forecast volume is exceeded.
4. Hotel penalty applies to unused beds.
5. Winner must satisfy `avg_sell_price >= avg_buy_price`.

---

## Gameplay

### Phase 1 - Fixed-Seat Auction

- Single sealed bid per team (`bid_price_per_seat`, `bid_quantity`, optional `budget_cap`).
- Sorted in descending price until the airline capacity earmarked for teams is exhausted (8 % of the aircraft seats per active team by default — e.g. 80 seats for one team, 320 seats for four teams).
- Pay-as-bid: the paid price matches the bid price. The airline rejects bids below its current floor (default €80), so lowball bids keep the full budget but receive zero seats.

### Phase 2 - Live Market (continuous countdown)

- Default update cadence ≈ 60 seconds (briefing → decision → clearance → debrief).
- Demand: `D(t) = D_base(t) * exp(-alpha * (P_min - P_ref) / P_ref)`.
- Logit choice with attention (`push_level`, tools) and anti-collusion penalties.
- Fixed-before-pooling: sell from `fixed_left` first, then draw from the airline remainder (`C_remain`) at `P_airline(t)`.
- Pooling is automatically suspended for a team whenever the next pooling sale would push its cumulative loss beyond the insolvency threshold (default −€20 000). Sales resume once the team’s retail price matches or exceeds the live pooling price (or the airline price drops).
- Profit is always reported as `revenue - costs (fixed + pooling + ops)` and is capped at a minimum of −€20 000 to reflect the insolvency guard used across the UI, leaderboard, and point system.
- Airline repricing: `P_airline(t+1) = clamp(P_airline(t) + headroom(P_airline) * gamma * tanh(delta / kappa))`, so prices ease toward €400 only after sustained excess demand.
- Tools (`hedge`, `spotlight`, `commit`) cost cash and observe `rules.tool_cooldown_ticks` update cooldowns.
- Win condition: highest profit **and** `avg_sell_price >= avg_buy_price` (otherwise next best).

### Scoreboard & KPIs

Per update: airline price, remaining capacity, team sales (fixed/pooling), margin, market share, and the Total Market Demand ticker. Final reports include revenue, cost, profit, load factor, average sell/buy prices.

### Round Evaluation Recap

When a round ends the UI switches into an evaluation state:
- **Round Summary Card** — highlights your team’s seats sold, revenue, profit, point score, and round ranking.
- **Phase 1 Snapshot** — shows your requested vs. allocated fixed seats, clearing price, bid price, and top allocations for context.
- **Phase 2 Snapshot** — summarises pooling usage, remaining inventory, and the top three profit earners of the round.
- Live controls (Fix Market, “Your Decisions”) stay hidden until the next round starts so teams can focus on the recap.

---

## Operation

### Teams

1. Open the browser and register the team.
2. Phase 1: submit the bid and wait for the auction result.
3. Phase 2: throughout the countdown choose price, push level, fixed hold %, and optional tool when needed.
4. Monitor live snapshots and debriefs to stay ahead of rivals; once the round ends, review the evaluation recap before the next phase.
5. Use practice mode to explore strategies without a live session.

### Admins

1. Sign in via "Admin Login" (password from the environment file).
2. Manage the lobby, approve teams, start the fixed-seat auction.
3. Close the auction to display the allocation summary.
4. Start the live market: countdown, decisions, and debrief run automatically; the admin can reset anytime via the phase control card.
5. Practice mode is useful for onboarding new teams.

---

## Tests & Tooling

```bash
# Full Jest suite (frontend + engine + legacy backend)
npm test

# Backend tests only
cd server && npm test

# Playwright E2E
npm run test:e2e

# Storybook for UI components
npm run storybook
```

ESLint (`npm run lint`) and Vitest (via the Vite setup) are available; add Chromatic/CI workflows as needed.

---

## Deployment

### Render (Backend) + Vercel (Frontend)

1. **Backend (Render)**
   - Build: `npm install`
   - Start: `npm start`
   - Env: `PORT`, `NODE_ENV=production`, `FRONTEND_URL`, `ADMIN_PASSWORD`
2. **Frontend (Vercel)**
   - Build: `npm run build`
   - Env: `VITE_SERVER_URL=https://<render-backend>`

### Docker (Backend)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

```bash
docker build -t apxo-backend .
docker run -p 3001:3001 apxo-backend
```

---

## Troubleshooting

| Problem                            | Resolution |
|------------------------------------|------------|
| Socket connection fails            | Check `VITE_SERVER_URL` and `FRONTEND_URL`, adjust CORS whitelist |
| Ports 5173/3001 already in use     | Update ports in `.env` |
| SQLite corrupted/outdated          | Delete `server/database.sqlite` locally and restart the server |
| Storybook does not load            | Ensure `npm run storybook` runs from the repo root |
| Practice mode uses old config      | Update `apxo.config.yaml` and restart the frontend |

---

## Next Steps

- Gradually migrate backend logic to the new engine (practice mode already uses it, live play still relies on the legacy service).
- Establish CI pipelines (lint/test/build/storybook).
- Harden persistence and migrations for production (SQLite to Postgres, backups).
- Expand observability (structured logs, metrics).

---

Questions? Open an issue on GitHub or file it on the project board. Have fun simulating!
