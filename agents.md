# APXO – Agents Guide

Stand: 12. März 2026

Dieses Dokument liefert kompakten Kontext zum aktuellen Projektstatus und skizziert die nächsten sinnvollen Schritte. Es richtet sich an Maintainer:innen, Contributor:innen und Automations-/KI-Agenten, die Aufgaben planen oder priorisieren.

## Kurzüberblick
- Zweck: Echtzeit Multi-User-Simulation (Fixplatz-Auktion + Live-Markt) für Touristik-Beschaffung & Nachfrage.
- Architektur: React + Vite (Frontend) · Agent-v1-Simulation in TypeScript (`src/lib/simulation`) · Node/Express + Socket.IO (Backend) · SQLite/Sequelize (Persistenz).
- Entwicklungs-Hilfen: Storybook, Jest (inkl. Engine-Tests), Playwright, ESLint, Tailwind + shadcn/ui.
- Deploy-Ziele: Frontend via Vercel, Backend via Render/Railway (alternativ lokale Netzfreigabe).

## Aktueller Zustand
- **Frontend**: Vite-Dev-Server (`npm run dev`). UI unter `src/components`, Practice Mode nutzt Agent-v1-Engine. Globaler Zustand in `src/contexts/GameContext.tsx`. Storybook funktionsfähig (`npm run storybook`).
- **Simulation Engine**: `src/lib/simulation/{types,engine,defaultConfig}.ts` + `apxo.config.yaml`. Unit-Tests decken Auktion, Fix-vor-Pooling, Airline-Repricing, Hotel-Penalty & Siegerbedingung ab (`npm test -- --runTestsByPath src/lib/simulation/__tests__/engine.test.ts`).
- **Backend**: Legacy-Service (`server/gameService.js`) liefert Lobby/Realtime weiterhin. Integration auf neue Engine steht aus.
- **Dokumentation**: README aktualisiert (Simulation Core, Practice Mode, Setup). Agents-Guide liefert Prioritäten.
- **Tests & Qualität**: Jest (Frontend + Engine), Backend-Jest separiert (`server/`). Playwright vorhanden, ESLint aktiv.

## Environments & Skripte
- Frontend `.env.local`:
  - `VITE_SERVER_URL` (z. B. `http://localhost:3001`)
- Backend `server/.env`:
  - `PORT`, `NODE_ENV`, `FRONTEND_URL`, optional lokal `ADMIN_PASSWORD`
- Root `package.json` (Auswahl):
  - `dev`, `build`, `preview` (Frontend)
  - `server`, `server:dev` (Backend-Start aus Root)
  - `storybook`, `build-storybook`
  - `test`, `test:frontend`, `test:backend`, `test:e2e`
  - `lint`, `lint:fix`
- Server `package.json`:
  - `dev` → `node server.js`, `start` → `node index.js`, `test` (Jest)

## Fähigkeiten (Ist)
- Multi-User-Teamregistrierung, Admin-Login (Env-Passwort), Phasensteuerung (Auktion → Live-Markt) im Backend.
- Agent-v1-Simulation vollständig in TypeScript verfügbar (Fix-Auktion, 12–15 Ticks, Airline-Repricing, Tools, Hotel-Penalty).
- Practice Mode nutzt neue Engine end-to-end; Live-Spiel verwendet noch Legacy-Serverberechnungen.
- UI: Responsive, Komponentenbibliothek (shadcn/ui), Storybook-Stories & Animations.
- Datenhaltung: SQLite via Sequelize, automatische Anlage. Persistierte Sessions/Teams vorhanden.

## Bekannte Lücken / Risiken
- **Engine-Integration**: Backend nutzt weiterhin Legacy-Berechnungen. Socket-Events müssen auf neue Engine migriert werden.
- **Persistenz**: SQLite ohne Migrationen/Backups; keine Versionierung von Spielständen.
- **Security**: Admin-Auth simpel, kein Rate Limiting oder Auditing.
- **Validation**: Keine zentrale Schema-/Env-Validierung (z.B. Zod/envalid).
- **Observability**: Logging = Console, keine strukturierten Logs/Request-IDs.
- **Load/Chaos**: Keine Last- oder Ausfallszenarien dokumentiert.

## Roadmap (Vorschlag)
1. **Engine ↔ Backend**
   - Socket-Events (`tick:briefing`, `tick:results`, etc.) auf neue Engine umstellen.
   - Persistente Speicherung der Fixplatz-Allokation + Tick-Decisions.
   - Historisierung/Replay (optional JSON-Export).
2. **Stabilität & Sicherheit**
   - Env-/Request-Validierung (z.B. `zod` oder `envalid`).
   - Rate Limiting, Audit-Logs, härteres Admin-Login (z.B. Passkeys oder temporäre Codes).
   - Strukturierte Logs (`pino`), Request-IDs.
3. **Persistenz & Daten**
   - Migrationen (Umzug/Sequelize-CLI), Option Postgres.
   - Backup-/Restore-Strategie, ggf. Snapshotting nach jeder Runde.
4. **Qualität & CI**
   - GitHub Actions: lint/test/build/storybook.
   - Contract-Tests für Socket.IO, zusätzliche Engine-Cases (Tools, Collusion, Hold-Strategien).
   - Visuelle Tests (Chromatic/Playwright-Snapshots) für kritische Screens.
5. **UX & Enablement**
   - Analytics-Panel (Nachfragekurven, Preisverlauf, Attention).
   - Admin-Presets (vorkonfigurierte `apxo.config.yaml` Varianten).
   - Onboarding (interaktive Guides, Tooltips), erweiterter Practice Mode Export.
6. **Deployment**
   - Produktions-Runbook (Monitoring, Scaling, Incident-Response).
   - Health-/Readiness-Probes + Status-Endpoint härten.

## Technische Entscheidungen (Auszug)
- Client: React 19, Vite, Tailwind, shadcn/ui, Framer Motion.
- Simulation: TypeScript Engine (`src/lib/simulation`), Config via YAML Loader (`yaml`-Dependency).
- Server: Node/Express + Socket.IO, Admin-Passwort via Env, Legacy GameService pending refactor.
- DB: SQLite (default) über Sequelize, Optionale Erweiterung auf Postgres geplant.
- Docs: README = Architektur & Setup; Agents-Guide = Priorisierung.

## Offene Fragen
- Wie erfolgt die vollständige Migration des Live-Spiels auf die Agent-v1-Engine (State- und Event-Modell)?
- Welche Datenbank soll Produktionsstandard werden (SQLite vs. Postgres) und wie sieht die Migrationsstrategie aus?
- Brauchen wir erweiterte Auth (Sessions, MFA, Rollen)?
- Soll Visual Regression (Chromatic/Playwright Snapshots) Teil der CI werden?
- Wie werden Spielstände versioniert/archiviert (Kompatibilität zwischen Releases)?

- **Lokal starten**
  ```bash
  # Backend (Legacy Gameplay)
  cd server && npm run dev
  # Frontend in neuem Terminal
  npm run dev
  # Storybook
  npm run storybook
  ```
- **Simulation prüfen**
  ```bash
  npm test -- --runTestsByPath src/lib/simulation/__tests__/engine.test.ts
  ```
- **Practice Mode**: Im Frontend oben rechts aktivierbar, nutzt neue Engine.
- **Watchpoints**: Socket.IO-Events, Config-Änderungen (`apxo.config.yaml`), Admin-Panel (Legacy vs. neue Engine).

Hinweis: Dieses Dokument bezieht sich ausschließlich auf APXO und enthält keine Referenzen auf andere Projekte.
