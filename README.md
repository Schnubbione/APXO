# APXO – Touristic Procurement & Demand Simulation

APXO ist eine echtzeitfähige Zwei-Phasen-Simulation für Beschaffung & Nachfrage im Tourismus. Teams konkurrieren zunächst in einer verdeckten Fixplatz-Auktion (Phase 1) und agieren anschließend in einem verdichteten Live-Markt mit Logit-Nachfrage, Airline-Repricing und Hotelkapazitätskosten (Phase 2).

---

## Highlights

- **Agent v1 Engine** – Typsichere Simulation (`src/lib/simulation/engine.ts`) mit Fixplatz-Auktion, 12–15 Monats-Ticks, Airline-Repricing auf Forecast-Basis, Attention-Boosts und Kollusions-Wächter.
- **Config-Driven Gameplay** – Standard-Szenario in `apxo.config.yaml`; lässt sich für Workshops oder Tests leicht überschreiben.
- **Practice Mode** – Frontend-interner Übungsmodus (ohne Backend) nutzt die Engine für schnelle Demorunden.
- **Multi-User Lobby** – Socket.IO synchronisiert Teamregistrierung, Admin-Steuerung, Snapshots und Leaderboard in Echtzeit.
- **Hotelkapazität & Penalty** – Gleiches Hotelkontingent pro Team; leere Betten kosten 50 € je Bett.
- **UI-Toolkit** – Tailwind + shadcn/ui, Storybook, Animations via Framer Motion, responsive Layouts.
- **CI-ready Tooling** – Jest/Vitest, Playwright, ESLint. Spezifische Engine-Tests sichern die Kerndomäne ab.

---

## Architektur (Kurz)

| Layer      | Tech & Pfad                                   | Zweck |
|------------|-----------------------------------------------|-------|
| Frontend   | React 19 + Vite (`src/`)                      | UI, Echtzeit-Ansichten, Practice Mode |
| Simulation | TS Engine (`src/lib/simulation/`)             | Zwei-Phasen-Spielregeln, Config-Lader |
| Backend    | Node/Express + Socket.IO (`server/`)          | Lobby, Admin-Control, Persistenz (SQLite/Sequelize) |
| Styling    | Tailwind, shadcn/ui, custom Animations        | Komponenten, Layout |
| Testing    | Jest, Playwright, Storybook, ESLint           | Qualitätssicherung |

---

## Quickstart

### Voraussetzungen

- Node.js ≥ 18
- npm oder yarn
- Git

### Installation

```bash
git clone https://github.com/Schnubbione/APXO.git
cd APXO
npm install
cd server && npm install && cd ..
```

### Umgebungsvariablen

Frontend (`.env.local`):
```env
VITE_SERVER_URL=http://localhost:3001
```

Backend (`server/.env`):
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ADMIN_PASSWORD=admin123   # nur lokal, in Produktion ersetzen
```

### Server starten

Terminal 1 – Backend:
```bash
cd server
npm run dev   # oder npm start
```

Terminal 2 – Frontend:
```bash
npm run dev
```

Aufrufe:
- Frontend: http://localhost:5173
- Backend Health: http://localhost:3001

### Practice Mode (Agent v1)

Im laufenden Frontend kann über den Button „Practice Mode“ oben rechts eine komplette Simulation (Fixplatz-Auktion + 12 Ticks) ohne Backend durchgeführt werden. Konfiguration basiert auf `apxo.config.yaml`.

---

## Simulation Engine

- **Config Loader:** `src/lib/simulation/defaultConfig.ts` lädt `apxo.config.yaml` via `yaml`-Parser.
- **Interfaces:** `src/lib/simulation/types.ts` definiert sämtliche Datentypen (Bids, Decisions, Snapshots, FinalReport).
- **Engine:** `src/lib/simulation/engine.ts`
  - `runAuction` – Pay-as-Bid, sortiert nach Gebot, Budget-Kappung optional.
  - `runTick` – Logit-Nachfrage (α, β), Attention & Tools mit Cooldown, Fix-vor-Pooling, Airline-Repricing.
  - `finalize` – Hotel-Penalty, Siegerlogik (Gewinn + Preisbedingung), Load-Factor.
  - Hilfsfunktionen für seeded RNG, Kollusions-Wächter, Preisgrenzen.
- **Demo:** `src/lib/simulation/demo.ts` baut auf dem Default-Config eine komplette Timeline inklusive Abschlussergebnis.

### Engine-Tests

```bash
npm test -- --runTestsByPath src/lib/simulation/__tests__/engine.test.ts
```

Abgedeckte Szenarien:
1. Auktion vergibt Seats Pay-as-Bid, absteigend sortiert.
2. Verkäufe ziehen Fix-Inventar vor Pooling.
3. Airline-Preis steigt bei Übererfüllung des Forecasts.
4. Hotel-Penalty wirkt bei leeren Betten.
5. Sieger benötigt `avg_sell_price >= avg_buy_price`.

---

## Gameplay

### Phase 1 – Fixplatz-Auktion

- Einmaliges, verdecktes Gebot pro Team (`bid_price_per_seat`, `bid_quantity`, optional `budget_cap`).
- Sortierung absteigend nach Preis, Vergabe bis Airline-Gesamtkapazität ausgeschöpft.
- Pay-as-Bid: bezahlter Preis = Gebotspreis.
- Hotel-Kontingent wird nach Abschluss gleich verteilt (`hotel.capacity_per_team`).

### Phase 2 – Live-Markt (12–15 Ticks)

- Tick dauert default 60 Sek. (Briefing → Entscheidung → Clearance → Debrief).
- Nachfrage: `D(t) = D_base(t) * exp(-alpha * (P_min - P_ref) / P_ref)`.
- Logit-Auswahl mit Attention (`push_level`, Tools) und Anti-Kollusions-Malus.
- Fix vor Pooling: zuerst `fixed_left`, dann Airline-Rest (`C_remain`) zu `P_airline(t)`.
- Airline-Repricing: `P_airline(t-1) = clamp(P_airline(t) * (1 + γ * tanh(Δ/κ)))`.
- Tools (`hedge`, `spotlight`, `commit`) haben Kosten und Cooldown (`rules.tool_cooldown_ticks`).
- Siegbedingung: höchster Profit **und** `avg_sell_price >= avg_buy_price` (sonst nächstbester).

### Scoreboard & KPIs

Pro Tick: Airlinepreis, verbleibende Kapazität, team-spezifische Verkäufe (Fix/Pooling), Marge, Marktanteil. Finale Reports enthalten Revenue, Cost, Profit, Hotel-Penalty, Load Factor, durchschnittliche Verkaufs-/Einkaufspreise.

---

## Bedienung

### Teams

1. Browser öffnen → Team registrieren.
2. Phase 1: Gebot abgeben und Auktion abwarten.
3. Phase 2: Für jeden Tick Preis, Push-Level, Fix-Hold %, optional Tool setzen.
4. Live-Snapshots & Debriefs verfolgen, Hotelpenalty im Blick behalten.
5. Practice Mode nutzen, um Strategien ohne Live-Session zu testen.

### Admins

1. Über „Admin Login“ anmelden (Passwort aus Env).
2. Lobby verwalten, Teams bestätigen, Fixplatz-Auktion starten.
3. Auktion schließen → Allocation Summary wird angezeigt.
4. Live-Markt starten: Countdown, Entscheidungen & Debrief erfolgen automatisch, Admin kann jederzeit resetten.
5. Practice Mode eignet sich zur Einführung neuer Teams.

---

## Tests & Tooling

```bash
# Gesamte Jest-Suite (Frontend + Engine + Backend-Legacy)
npm test

# Backend-Tests isoliert
cd server && npm test

# E2E mit Playwright
npm run test:e2e

# Storybook für UI-Komponenten
npm run storybook
```

ESLint (`npm run lint`) und Vitest (via Vite-Setup) sind verfügbar; Chromatic/CI-Workflows können ergänzt werden.

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

| Problem                            | Lösung |
|------------------------------------|--------|
| Socket-Verbindung schlägt fehl     | `VITE_SERVER_URL` und `FRONTEND_URL` prüfen, CORS-Whitelist anpassen |
| Ports 5173/3001 belegt             | Ports in `.env` ändern |
| SQLite defekt / veraltet           | `server/database.sqlite` löschen (lokal) und Server neu starten |
| Storybook lädt nicht               | Prüfen, ob `npm run storybook` in Root ausgeführt wurde |
| Practice Mode nutzt alte Config    | `apxo.config.yaml` anpassen, Frontend neu starten |

---

## Weiterentwicklung

- Backend-Logik Schritt für Schritt auf neue Engine heben (aktuell nutzt Practice Mode die neue Logik, Live-Spiel folgt Legacy-Service).
- CI-Pipeline aufsetzen (Lint/Test/Build/Storybook).
- Persistenz & Migrationen für Produktionsbetrieb härten (SQLite → Postgres, Backups).
- Beobachtbarkeit (strukturierte Logs, Metrics) ergänzen.

---

Fragen? Issues gerne via GitHub melden oder direkt im Projektboard vermerken. Viel Spaß beim Simulieren!
