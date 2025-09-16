# APXO – Agents Guide

Stand: 13. September 2025

Dieses Dokument liefert kompakten Kontext zum aktuellen Projektstatus und skizziert die nächsten sinnvollen Schritte. Es richtet sich an Maintainer:innen, Contributor:innen und Automations-/KI-Agenten, die Aufgaben planen oder priorisieren.

## Kurzüberblick
- Zweck: Echtzeit, Multi-User-Simulation für Beschaffung & Nachfrage im Tourismus.
- Architektur: React + Vite (Frontend) · Node/Express + Socket.IO (Backend) · SQLite/Sequelize (Persistenz).
- Entwicklungs-Hilfen: Storybook, Jest/Vitest, Playwright, ESLint, Tailwind + shadcn/ui.
- Deploy-Ziele: Frontend auf Vercel, Backend auf Render/Railway (alternativ lokale Netzfreigabe).

## Aktueller Zustand
- Frontend: Läuft mit Vite-Dev-Server (`npm run dev`). UI-Komponenten in `src/components` und `src/components/ui`. Globaler Zustand in `src/contexts/GameContext.tsx`. Storybook vorhanden (`npm run storybook`).
- Backend: Start über `server/` mit `npm run dev` (lokal) bzw. `npm start`. Socket.IO für Realtime. DB: SQLite, Modelle und Logik in `server/models.js`, `server/gameService.js`.
- Dokumentation: Ausführliche README mit Architektur, Setup, API-Events und Tech-Day-Checkliste.
- Tests & Qualität: Jest-Konfiguration vorhanden (Frontend/Backend getrennt testbar). E2E via Playwright. ESLint eingerichtet. 

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
- Multi-User-Teamregistrierung, Admin-Login (Passwort via Env), Runden- & Phasensteuerung.
- Live-Synchronisation über Socket.IO; Leaderboard & Ergebnisse in Echtzeit.
- Einkaufsphase mit Informationsasymmetrie (Fix/ProRata/Pooling), Budgetlogik inkl. Insolvenzprüfung.
- Hotelkapazität: Gleichverteilung pro Team; Leerkosten berücksichtigt.
- UI: Responsiv, Komponentenbibliothek mit Varianten; Storybook-Beispiele für `Button`, `Card`, `Input`.

## Bekannte Lücken / Risiken
- Persistenz: SQLite im Standard – Migrations- und Backup-Strategie für Produktion noch vereinfachend.
- Sicherheit: Admin-Auth einfach (Passwort). Kein Rate Limiting/Brute-Force-Schutz konfiguriert.
- Beobachtbarkeit: Logging ist konsolenbasiert; es fehlen strukturierte Logs/Tracing.
- Lastverhalten: Keine Lasttests/Benchmarks dokumentiert.
- Fehlerrobustheit: Eingabevalidierung nur grob skizziert; fehlende zentrale Schema-Validierung.

## Roadmap (vorschlag)
1. Stabilität & Sicherheit
   - Env-Validierung (z. B. `zod`/`envalid`), zentrale Request-Validierung (z. B. `zod` oder `yup`).
   - Rate Limiting & Admin-Login-Abhärtung; CORS-Whitelist klar definieren.
   - Strukturierte Logs (z. B. `pino`) + Request-IDs.
2. Daten & Persistenz
   - DB-Migrationen einführen (z. B. `sequelize-cli`/`umzug`).
   - Optionale Postgres-Unterstützung für Produktionsbetrieb.
   - Export/Import von Spielständen (JSON) für Demos/Tech Day.
3. Qualität & Tests
   - CI-Workflow (Build, Lint, Test, Storybook-Build, ggf. Chromatic Visual Tests).
   - Unit-Tests für `server/gameService.js` und kritische Berechnungen.
   - Contract-Tests für Socket.IO Events.
4. UX & Features
   - Erweiterte Analytics-Ansicht (Nachfragekurven, Preiselastizität, Zeitverlauf).
   - Admin-Panel: Presets/Scenarios speichern & laden.
   - Onboarding/Tutorial erweitern (interaktive Hilfen, Tooltips).
5. Deployment
   - Produktions-Runbooks (Scaling, Monitoring, Backups).
   - Health-/Readiness-Probes; Status-Endpoint härten.

## Technische Entscheidungen (Auszug)
- Client: React 19, Vite, Tailwind, shadcn/ui für schnelle UI-Iterationen.
- Server: Node + Express + Socket.IO für Realtime; einfache Admin-Auth via Env.
- DB: SQLite per Default; Sequelize als ORM zur späteren DB-Agnostik.
- Docs: README als Single-Source-of-Truth; Storybook für UI-Dokumentation.

## Offene Fragen
- Sollen Spielstände langfristig versioniert werden (Kompatibilität zwischen Releases)?
- Ziel-DB für Produktion (SQLite vs. Postgres) und Migrationsstrategie?
- Auth-Erweiterungen (z. B. Session-Handling, Tokens) nötig?
- Visual Regression in CI gewünscht (Chromatic/Playwright Snapshots)?

## Quickstart für Agents
- Lokal starten:
  ```bash
  # Backend
  cd server && npm run dev
  # Frontend in neuem Terminal
  npm run dev
  # Storybook
  npm run storybook
  ```
- Prüfpunkte:
  - Frontend auf `http://localhost:5173`, Backend auf `http://localhost:3001`.
  - Socket.IO Verbindungen stabil; Teamregistrierung und Admin-Login funktionieren.
  - Stories rendern in Storybook; UI-Regressionen im Blick behalten.

Hinweis: Dieses Dokument bezieht sich ausschließlich auf APXO und enthält keine Referenzen auf andere Projekte.
