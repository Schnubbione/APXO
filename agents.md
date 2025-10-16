# APXO - Agents Guide

Updated: March 19, 2026 (multi-session update)

This document compresses the current project context and outlines sensible next steps. It is aimed at maintainers, contributors, and automation/AI agents that plan or prioritise work.

## Quick Overview
- Purpose: Real-time multi-user simulation (fixed-seat auction + live market) for touristic procurement and demand.
- Architecture: React + Vite (frontend) · Agent v1 simulation in TypeScript (`src/lib/simulation`) · Node/Express + Socket.IO (backend) · SQLite/Sequelize (persistence, named sessions + migration helper).
- Dev Tooling: Storybook, Jest (incl. engine tests), Playwright, ESLint, Tailwind + shadcn/ui.
- Deployment Targets: Frontend via Vercel, backend via Render/Railway (or local network exposure).

## Current State
- **Frontend**: Vite dev server (`npm run dev`). UI lives in `src/components`, practice mode already uses the Agent v1 engine. Global state handled in `src/contexts/GameContext.tsx`. Storybook works (`npm run storybook`). Fresh evaluation view replaces the old Fix Market/Your Decisions panels after each round, the Phase 2 launch dialog surfaces Phase 1 context, and the admin console now shows a session banner (selector + launch button) alongside the phase control card.
- **Simulation Engine**: `src/lib/simulation/{types,engine,defaultConfig}.ts` + `apxo.config.yaml`. Unit tests cover auction, fixed-before-pooling, airline repricing, and win condition (`npm test -- --runTestsByPath src/lib/simulation/__tests__/engine.test.ts`).
- **Backend**: Socket.IO lobby now supports named sessions (slugged, owner aware). Reset/analytics/launch commands are session-scoped; idle teams are auto-logged out after 15 minutes, empty sessions are pruned on the same cadence, and admins can purge every session to rebuild a clean lobby. Legacy service still drives live calculations (engine integration pending).
- **Documentation**: README updated (simulation core, practice mode, multi-session + migration). Agents Guide provides priorities.
- **Tests & Quality**: Jest (frontend + engine), separate backend Jest suite (`server/`). Playwright exists, ESLint enforced.

## Environments & Scripts
- Frontend `.env.local`:
  - `VITE_SERVER_URL` (e.g. `http://localhost:3001`)
- Backend `server/.env`:
  - `PORT`, `NODE_ENV`, `FRONTEND_URL`, optional local `ADMIN_PASSWORD`
  - Optional `TEAM_INACTIVITY_TIMEOUT_MINUTES` to override the 15 minute idle logout
- Root `package.json` (selection):
  - `dev`, `build`, `preview` (frontend)
  - `server`, `server:dev` (start backend from root)
  - `storybook`, `build-storybook`
  - `test`, `test:frontend`, `test:backend`, `test:e2e`
  - `lint`, `lint:fix`
- Server `package.json`:
  - `dev` → `node server.js`, `start` → `node index.js`, `test` (Jest), `migrate:sessions`

## Capabilities (Today)
- Multi-session lobby: teams register per session, the first entrant becomes session owner (can launch multiplayer rounds). Sessions auto-prune once they stay idle with no active teams.
- Admin dashboard exposes a session selector, launch shortcut, per-session reset/analytics controls, and a danger-zone purge that clears every session.
- Agent v1 simulation fully available in TypeScript (fixed auction, 12-15 countdown updates, airline repricing, tools).
- Practice mode uses the new engine end-to-end; live play still relies on legacy server calculations.
- Round evaluation screen summarises Phase 1 allocation, Phase 2 performance, and top performers while live controls are hidden.
- Airline guardrails: auto-calculated fixed-seat share (8 % per active team), minimum bid tied to airline floor, pooling pause before insolvency, profit clamped at −€20 000, headroom-based repricing toward €400.
- UI: Responsive layouts, component library (shadcn/ui), Storybook stories and animations.
- Data: SQLite via Sequelize with automatic schema creation plus migration helper (`npm run migrate:sessions`). Active teams auto-logout after 15 minutes (configurable).

## Known Gaps & Risks
- **Engine Integration**: Backend still executes legacy calculations. Socket events must migrate to the new engine.
- **Persistence**: Only a bespoke session migration exists; no general migration/backups or game-state versioning.
- **Security**: Admin auth is basic, no rate limiting or auditing.
- **Validation**: No central schema/env validation (e.g. Zod or envalid).
- **Observability**: Console logging only, no structured logs or request IDs.
- **Session UX**: Ownership transfer remains manual; no tooling for merging/archiving sessions beyond the new full purge.
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
   - Formalise migration tooling (beyond the session helper) and optional Postgres support.
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
- **Session Migration**
  ```bash
  cd server && npm run migrate:sessions
  ```
- **Practice Mode**: Toggle in the frontend (top right); runs on the new engine.
- **Watchpoints**: Socket.IO events, config changes (`apxo.config.yaml`), admin panel (legacy vs. new engine), inactivity cleanup (team timeout + session pruning).

Note: This document refers exclusively to APXO and does not reference other projects.
