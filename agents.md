# APXO - Agents Guide

Updated: March 19, 2026

This document compresses the current project context and outlines sensible next steps. It is aimed at maintainers, contributors, and automation/AI agents that plan or prioritise work.

## Quick Overview
- Purpose: Real-time multi-user simulation (fixed-seat auction + live market) for touristic procurement and demand.
- Architecture: React + Vite (frontend) · Agent v1 simulation in TypeScript (`src/lib/simulation`) · Node/Express + Socket.IO (backend) · SQLite/Sequelize (persistence).
- Dev Tooling: Storybook, Jest (incl. engine tests), Playwright, ESLint, Tailwind + shadcn/ui.
- Deployment Targets: Frontend via Vercel, backend via Render/Railway (or local network exposure).

## Current State
- **Frontend**: Vite dev server (`npm run dev`). UI lives in `src/components`, practice mode already uses the Agent v1 engine. Global state handled in `src/contexts/GameContext.tsx`. Storybook works (`npm run storybook`). Fresh evaluation view replaces the old Fix Market/Your Decisions panels after each round, and the Phase 2 launch dialog now surfaces Phase 1 context (allocation, budget balance, airline price range) before teams set their opening price.
- **Simulation Engine**: `src/lib/simulation/{types,engine,defaultConfig}.ts` + `apxo.config.yaml`. Unit tests cover auction, fixed-before-pooling, airline repricing, and win condition (`npm test -- --runTestsByPath src/lib/simulation/__tests__/engine.test.ts`).
- **Backend**: Legacy service (`server/gameService.js`) still powers lobby/realtime. Integration with the new engine is pending.
- **Documentation**: README updated (simulation core, practice mode, setup). Agents Guide provides priorities.
- **Tests & Quality**: Jest (frontend + engine), separate backend Jest suite (`server/`). Playwright exists, ESLint enforced.

## Environments & Scripts
- Frontend `.env.local`:
  - `VITE_SERVER_URL` (e.g. `http://localhost:3001`)
- Backend `server/.env`:
  - `PORT`, `NODE_ENV`, `FRONTEND_URL`, optional local `ADMIN_PASSWORD`
- Root `package.json` (selection):
  - `dev`, `build`, `preview` (frontend)
  - `server`, `server:dev` (start backend from root)
  - `storybook`, `build-storybook`
  - `test`, `test:frontend`, `test:backend`, `test:e2e`
  - `lint`, `lint:fix`
- Server `package.json`:
  - `dev` → `node server.js`, `start` → `node index.js`, `test` (Jest)

## Capabilities (Today)
- Multi-user team registration, admin login (env password), phase control (auction → live market) in the backend.
- Agent v1 simulation fully available in TypeScript (fixed auction, 12-15 countdown updates, airline repricing, tools).
- Practice mode uses the new engine end-to-end; live play still relies on legacy server calculations.
- Round evaluation screen summarises Phase 1 allocation, Phase 2 performance, and top performers while live controls are hidden.
- Airline guardrails in place: only 20 % of seats are released in Phase 1 by default (admin-adjustable), the auction enforces a minimum bid tied to the airline floor, pooling sales pause before breaching the insolvency limit, and profit is clamped at −€20 000 everywhere it is displayed.
- UI: Responsive layouts, component library (shadcn/ui), Storybook stories and animations.
- Data: SQLite via Sequelize with automatic schema creation. Sessions/teams persist.

## Known Gaps & Risks
- **Engine Integration**: Backend still executes legacy calculations. Socket events must migrate to the new engine.
- **Persistence**: SQLite without migrations/backups; no versioning for game states.
- **Security**: Admin auth is basic, no rate limiting or auditing.
- **Validation**: No central schema/env validation (e.g. Zod or envalid).
- **Observability**: Console logging only, no structured logs or request IDs.
- **Load/Chaos**: Load or failure scenarios are undocumented.

## Roadmap (Proposal)
1. **Engine ↔ Backend**
   - Rewire socket events (currently named `tick:briefing`, `tick:results`, etc.) to the new engine.
   - Persist fixed-seat allocation and per-update decisions.
   - Add history/replay (optional JSON export).
2. **Stability & Security**
   - Add env/request validation (e.g. `zod` or `envalid`).
   - Implement rate limiting, audit logs, stricter admin login (passkeys or temporary codes).
   - Introduce structured logging (`pino`) and request IDs.
3. **Persistence & Data**
   - Add migrations (Sequelize CLI) and optional Postgres support.
   - Define backup/restore strategy, possibly snapshot after every round.
4. **Quality & CI**
   - GitHub Actions for lint/test/build/storybook.
   - Contract tests for Socket.IO, additional engine cases (tools, collusion, hold strategies).
   - Visual tests (Chromatic/Playwright snapshots) for critical screens.
5. **UX & Enablement**
   - Analytics panel (demand curves, price trajectory, attention).
   - Admin presets (preconfigured `apxo.config.yaml` variants).
   - Onboarding (interactive guides, tooltips), expanded practice mode export.
6. **Deployment**
   - Production runbook (monitoring, scaling, incident response).
   - Harden health/readiness probes plus status endpoint.

## Technical Decisions (Excerpt)
- Client: React 19, Vite, Tailwind, shadcn/ui, Framer Motion.
- Simulation: TypeScript engine (`src/lib/simulation`), config via YAML loader (`yaml` dependency).
- Server: Node/Express + Socket.IO, admin password via env, legacy game service awaiting refactor.
- Database: SQLite (default) through Sequelize, planned upgrade path to Postgres.
- Docs: README = architecture & setup; Agents Guide = prioritisation.

## Open Questions
- How will the live game fully migrate to the Agent v1 engine (state and event model)?
- Which database should be the production default (SQLite vs. Postgres) and what migration strategy do we follow?
- Do we need extended authentication (sessions, MFA, roles)?
- Should visual regression (Chromatic/Playwright snapshots) be part of CI?
- How are game states versioned/archived to maintain compatibility across releases?

- **Local Launch**
  ```bash
  # Backend (legacy gameplay)
  cd server && npm run dev
  # Frontend in a new terminal
  npm run dev
  # Storybook
  npm run storybook
  ```
- **Simulation Check**
  ```bash
  npm test -- --runTestsByPath src/lib/simulation/__tests__/engine.test.ts
  ```
- **Practice Mode**: Toggle in the frontend (top right); runs on the new engine.
- **Watchpoints**: Socket.IO events, config changes (`apxo.config.yaml`), admin panel (legacy vs. new engine).

Note: This document refers exclusively to APXO and does not reference other projects.
