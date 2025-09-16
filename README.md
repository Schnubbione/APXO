# Touristic Procurement & Demand Simulation (APXO)

A real-time, multi-user simulation game for learning touristic procurement and demand management strategies.

## Features

- **Multi-User Support**: Multiple teams can join simultaneously from different devices
- **Real-Time Updates**: Live synchronization of game state across all participants
- **Admin Control**: Centralized admin panel for managing game parameters and rounds
- **Team Registration**: Simple team registration system with unique team names
- **Round-Based Gameplay**: Timed rounds with automatic progression
- **Live Leaderboard**: Real-time standings and results
- **Responsive Design**: Works on desktop and mobile devices
- **Strategic Information Asymmetry**: Teams don't see exact available capacity, promoting strategic decision-making
- **Market Intelligence**: Real-time market data and competitor analysis
- **Risk Management**: Balance guaranteed capacity vs. flexible procurement strategies
- **Hotel Capacity & Costs**: Equal hotel capacity per team; empty beds incur costs, selling beyond hotel capacity is allowed
- **Production-Safe Admin Auth**: Admin password via environment variables; no hardcoded defaults in production

## Detailed Setup Guide

### Prerequisites
- Node.js 18+ and npm (or yarn)
- Git
- SQLite (comes with Node.js)

### Development Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/Schnubbione/APXO.git
   cd APXO
   npm install
   cd server && npm install && cd ..
   ```

2. **Environment Configuration**
   
   Create `.env` files:
   
   **Frontend (.env.local)**
   ```bash
   VITE_SERVER_URL=http://localhost:3001
   ```
   
   **Backend (server/.env)**
   ```bash
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   ADMIN_PASSWORD=admin123  # Only for local development
   ```

3. **Database Setup**
   ```bash
   cd server
   # Database is automatically created on first run
   npm start
   ```

4. **Start Development Servers**
   
   **Terminal 1: Backend**
   ```bash
   cd server
   npm run dev  # or npm start
   ```
   
   **Terminal 2: Frontend**
   ```bash
   npm run dev
   ```

5. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

### Production Setup

#### Option 1: Vercel + Render

1. **Deploy Backend to Render**
   - Connect GitHub repo
   - Set build command: `npm install`
   - Set start command: `npm start`
   - Environment variables:
     ```
     PORT=10000
     NODE_ENV=production
     FRONTEND_URL=https://your-app.vercel.app
     ADMIN_PASSWORD=your-secure-password
     ```

2. **Deploy Frontend to Vercel**
   - Connect GitHub repo
   - Set build command: `npm run build`
   - Environment variables:
     ```
     VITE_SERVER_URL=https://your-backend.onrender.com
     ```

#### Option 2: Docker

```dockerfile
# Dockerfile for backend
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t apxo-backend .
docker run -p 3001:3001 apxo-backend
```

### Testing

```bash
# Frontend tests
npm test

# Backend tests
cd server && npm test

# E2E tests
npm run test:e2e

# Storybook for UI component development
npm run storybook
```

### Storybook

Storybook is configured for developing and testing UI components in isolation:

```bash
npm run storybook
```

This will start Storybook on `http://localhost:6006` where you can:
- View all UI components with different variants
- Test component interactions
- Generate documentation automatically
- Run visual regression tests

Available stories include:
- **Button**: All variants (default, destructive, outline, etc.) and sizes
- **Card**: Basic cards, cards with footers, and game-specific layouts
- **Input**: Form inputs with validation states
- **And more...**

### Troubleshooting

- **Port conflicts**: Change PORT in .env
- **CORS errors**: Verify FRONTEND_URL matches your frontend domain
- **Socket connection fails**: Check VITE_SERVER_URL and firewall settings
- **Database issues**: Delete database.sqlite and restart server

## How to Play

### For Teams
1. Open http://localhost:5173 in your browser
2. Enter your unique team name
3. Wait for the admin to start the round
4. **Phase 1**: Buy fixed seats under information asymmetry. Exact remaining availability and other teams’ purchases are hidden.
5. **Phase 2**: Set customer prices and pooling allocation based on market intelligence. Allocation details become visible after the first simulation round.
6. Each team receives an equal share of hotel capacity at pre-purchase. Empty beds incur a per-bed cost; sales above hotel capacity are allowed and still profitable (minus seat costs).
7. Monitor your results and leaderboard in real-time
8. **Strategic Challenge**: Balance guaranteed capacity, flexible options, and hotel capacity costs under incomplete information

### For Admins
1. Open http://localhost:5173 in your browser
2. Click "Admin Login" and enter the password from your environment (see Environment Setup). In production there is no default password.
3. Configure game parameters (demand, rounds, timing, etc.)
4. Start rounds and monitor all teams
5. View comprehensive admin dashboard with team decisions

## Procurement Products

The simulation features three different procurement products with varying risk profiles:

- **Fix (€60/seat)**: Cheapest option, but must be paid regardless of demand. Lowest risk for airline, highest risk for tour operator. **Strategic consideration**: Limited availability creates competition - you won't know exact numbers!
- **ProRata (€85/seat)**: More expensive, but can be returned until 60 days before departure if not booked. Medium risk for both parties.
- **Pooling (€110/seat)**: Highest price, daily price and availability updates, not guaranteed, only paid if actual demand exists. Highest risk for airline, lowest risk for tour operator.

**Key Strategic Element**: Fix seats are purchased under information asymmetry - teams see market intelligence but not exact availability, promoting strategic decision-making and risk assessment.
 
**Key Strategic Elements**
- Fix seats are purchased under information asymmetry — exact remaining availability is hidden. Allocation details become visible after the first simulation round.
- Equal hotel capacity is assigned per team in pre-purchase; empty beds incur a cost. Sales beyond hotel capacity are permitted and only subject to seat costs.

## Game Mechanics

- **Procurement**: Teams buy seat capacity using different risk products.
- **Pricing**: Teams set retail prices for their seats.
- **Demand**: Responds to prices (negative elasticity) and the capacity-weighted market price index.
- **Competition**: In shared market mode, customers choose the cheapest available option given availability.
- **Costs & Profit**: Profit = Ticket revenue − costs (fixed seats, variable ops, pooling usage at market price, empty hotel beds). No alternative revenue for unsold seats.
- **Information Asymmetry**: Exact remaining fix capacity and other teams’ purchases are hidden in Phase 1; allocation details are revealed after Round 1.
- **Hotel Capacity**: Equal hotel capacity per team; empty beds incur a per-bed cost; selling beyond hotel capacity is allowed.
- **Market Intelligence**: Live pooling market data to guide strategy.

## Budget & Insolvency

- Per-Team Budget: Admin konfiguriert ein einheitliches Budget pro Team (Admin Panel). Dieses Budget gilt für beide Phasen und alle Runden.
- Round 1 Cap: In Runde 1 dürfen Fixkäufe das Budget nicht überschreiten. Die Anfragen werden vor der proportionalen Zuteilung auf floor(Budget/Fixpreis) gekappt.
- Laufende Insolvenz: Während der Simulation wird fortlaufend geprüft, ob die bis dahin erzielten Erlöse minus Kosten (Fixkosten, genutztes Pooling, operative Kosten, potenzielle Hotel-Leerkosten) das Budget übersteigen. Wenn ja, wird das Team sofort insolvent erklärt.
- Folge der frühen Insolvenz: Bereits verkaufte Passagiere dieses Teams kehren als Nachfrage in den Markt zurück und werden über die verbleibende Zeit verteilt. Das insolvente Team nimmt nicht weiter am Matching teil.
- Rundenabschluss: Am Ende der Runde werden zusätzlich Hotel-Leerkosten verrechnet. In Runde 1 wird keine Insolvenz nachträglich ausgesprochen; ab Runde 2 kann eine negative Marge > Budget eine Insolvenz am Rundenende markieren.
- Practice Mode: Zufälliges Budget pro Team für Training; dieselben Regeln (inkl. Cap in Runde 1 und Insolvenzlogik) gelten lokal.

## Architecture

### Overview
APXO is a real-time multi-user simulation game built with a client-server architecture. The frontend provides an interactive UI for teams and admins, while the backend manages game state, business logic, and real-time communication.

### Frontend Architecture
- **Framework**: React 19 with TypeScript for type safety
- **Build Tool**: Vite for fast development and optimized production builds
- **Styling**: Tailwind CSS with Shadcn/ui components
- **State Management**: React Context (GameContext) for global game state
- **Real-time Communication**: Socket.IO client for WebSocket connections
- **Routing**: React Router for navigation (if needed)
- **Charts**: Recharts for data visualization
- **Animations**: Framer Motion for smooth transitions

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Real-time**: Socket.IO for bidirectional communication
- **Database**: SQLite with Sequelize ORM
- **Authentication**: Simple password-based admin auth (production-safe)
- **API**: RESTful endpoints with JSON responses
- **Error Handling**: Centralized error middleware
- **Logging**: Console-based logging (can be extended with Winston)

### Data Flow
1. **Client Connection**: Teams connect via Socket.IO
2. **State Synchronization**: Server broadcasts game state updates
3. **Decision Updates**: Teams send decisions → Server validates → Updates DB → Broadcasts changes
4. **Phase Management**: Server handles phase transitions and timing
5. **Results Calculation**: Server computes round results and persists to DB

### Key Components
- `MultiUserApp.tsx`: Main application component handling UI state
- `GameContext.tsx`: Centralized state management and Socket.IO integration
- `AdminPanel.tsx`: Admin controls and monitoring
- `TeamRegistration.tsx`: Team onboarding
- `RoundTimer.tsx`: Phase timing and countdown
- `server.js`: Main server entry point
- `gameService.js`: Business logic and database operations
- `models.js`: Database models and relationships

### Database Schema
- **Team**: Stores team info, decisions, and socket connections
- **GameSession**: Current game settings and state
- **RoundResult**: Historical results per round
- **HighScore**: Leaderboard data

### Security Considerations
- Input validation on both client and server
- CORS configuration for allowed origins
- Admin authentication via environment variables
- UUID-based team identification
- Rate limiting for API endpoints

## API Documentation

### REST Endpoints

#### GET /
Health check endpoint
```json
{
  "message": "APXO Server is running!",
  "environment": "development",
  "timestamp": "2025-09-06T12:00:00.000Z"
}
```

### Socket.IO Events

#### Client → Server Events

**Team Management**
- `registerTeam(teamName: string)` → Registers a new team
- `resumeTeam(token: string, ack: function)` → Resumes a team session
- `logoutTeam(ack: function)` → Logs out current team

**Admin Management**
- `adminLogin(password: string)` → Authenticates admin
- `updateGameSettings(settings: object)` → Updates game configuration
- `startPrePurchasePhase()` → Starts pre-purchase phase
- `startSimulationPhase()` → Starts simulation phase
- `endRound()` → Ends current round
- `endPhase()` → Ends current phase
- `resetAllData()` → Resets all game data
- `resetCurrentGame()` → Resets current game (keeps high scores)

**Game Actions**
- `updateTeamDecision(decision: object, ack: function)` → Updates team decisions
- `startPracticeMode(config: object)` → Starts practice mode
- `getAnalytics()` → Requests analytics data

#### Server → Client Events

**Game State**
- `gameState(gameState: object)` → Initial game state on connection
- `gameStateUpdate(gameState: object)` → Game state updates
- `phaseStarted(phase: string)` → Phase start notification
- `phaseEnded(data: object)` → Phase end notification
- `roundEnded(data: object)` → Round end with results
- `fixSeatsAllocated(data: object)` → Fix seat allocation results

**Team Management**
- `registrationSuccess(team: object)` → Team registration success
- `registrationError(message: string)` → Team registration failure
- `resumeToken(token: string)` → Resume token for session recovery

**Admin Management**
- `adminLoginSuccess()` → Admin login success
- `adminLoginError(message: string)` → Admin login failure

**Practice Mode**
- `practiceResults(data: object)` → Practice mode results
- `practiceError(message: string)` → Practice mode error

**System**
- `error(message: string)` → General error notification
- `dataReset(data: object)` → Data reset confirmation
- `currentGameReset(data: object)` → Current game reset confirmation

### Data Structures

#### GameState
```typescript
interface GameState {
  teams: Team[];
  currentRound: number;
  isActive: boolean;
  baseDemand: number;
  spread: number;
  shock: number;
  sharedMarket: boolean;
  seed: number;
  roundTime: number;
  fares: Fare[];
  currentPhase: 'prePurchase' | 'simulation';
  phaseTime: number;
  totalCapacity: number;
  totalAircraftSeats: number;
  totalFixSeats: number;
  availableFixSeats: number;
  fixSeatPrice: number;
  poolingCost?: number;
  simulationMonths: number;
  departureDate: Date;
  fixSeatsAllocated?: boolean;
  poolingReserveCapacity?: number;
  poolingMarketUpdateInterval?: number;
  simulatedWeeksPerUpdate?: number;
  demandVolatility?: number;
  priceElasticity?: number;
  marketConcentration?: number;
  costVolatility?: number;
  crossElasticity?: number;
  poolingMarket?: {
    currentPrice: number;
    totalPoolingCapacity: number;
    availablePoolingCapacity: number;
    offeredPoolingCapacity: number;
    currentDemand: number;
    lastUpdate: string;
    priceHistory: Array<{ price: number; timestamp: string }>;
  };
  hotelBedCost?: number;
  hotelCapacityAssigned?: boolean;
  hotelCapacityPerTeam?: number;
  hotelCapacityRatio?: number;
  perTeamBudget?: number;
  remainingTime?: number;
  simulatedDaysUntilDeparture?: number;
  simState?: {
    perTeam: Record<string, {
      fixRemaining?: number;
      poolRemaining?: number;
      sold?: number;
      poolUsed?: number;
      demand?: number;
      initialFix?: number;
      initialPool?: number;
      revenue?: number;
      cost?: number;
      insolvent?: boolean;
    }>;
    returnedDemandRemaining?: number;
  };
}
```

#### Team
```typescript
interface Team {
  id: string;
  name: string;
  decisions: {
    price: number;
    buy: Record<string, number>;
    fixSeatsPurchased: number;
    fixSeatsAllocated?: number;
    poolingAllocation: number;
    hotelCapacity?: number;
  };
  totalProfit: number;
}
```

#### RoundResult
```typescript
interface RoundResult {
  teamId: string;
  sold: number;
  revenue: number;
  cost: number;
  profit: number;
  unsold: number;
  insolvent?: boolean;
}
```

## Development

### Project Structure
```
APXO/
├── server/                 # Backend server
│   ├── server.js          # Main server file
│   └── package.json       # Server dependencies
├── src/
│   ├── components/        # React components
│   ├── contexts/          # React contexts
│   ├── lib/              # Utilities
│   └── ...
├── package.json           # Frontend dependencies
└── README.md
```

### Key Components
- `MultiUserApp.tsx`: Main application component
- `GameContext.tsx`: Game state management
- `AdminPanel.tsx`: Admin control interface
- `TeamRegistration.tsx`: Team registration component
- `RoundTimer.tsx`: Round timing component

## Deployment für Tech Day

### Option 1: Lokale Netzwerk-Freigabe (Einfachste Lösung)

1. **Frontend für Netzwerk freigeben:**
   ```bash
   npm run dev -- --host
   ```
   Die App ist dann unter `http://[Ihre-IP-Adresse]:5173` erreichbar

2. **Backend für Netzwerk freigeben:**
   ```bash
   cd server
   npm start
   ```
   Backend läuft auf Port 3001

3. **Ihre lokale IP-Adresse finden:**
   ```bash
   ipconfig getifaddr en0  # macOS
   # oder
   hostname -I  # Linux
   ```

### Option 2: Online Deployment (Für globale Erreichbarkeit)

#### Frontend auf Vercel (Kostenlos)
1. **Repository auf GitHub pushen**
2. **Vercel Account erstellen:** https://vercel.com
3. **Neues Projekt erstellen:**
   - Repository importieren
   - Build Settings: `npm run build`
   - Output Directory: `dist`
4. **Environment Variables setzen:**
   - `VITE_SERVER_URL`: Ihre Backend-URL (z.B. `https://your-app.onrender.com`)

#### Backend auf Render (Kostenlos)
1. **Render Account erstellen:** https://render.com
2. **Neuen Web Service erstellen:**
   - Repository: Ihr GitHub Repo
   - Branch: main
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
3. **Environment Variables:**
   - `PORT`: 10000 (wird von Render gesetzt)
   - `NODE_ENV`: production
   - `FRONTEND_URL`: Ihre Vercel-URL (z.B. `https://your-app.vercel.app`)

#### Backend auf Railway (Kostenlos)
1. **Railway Account erstellen:** https://railway.app
2. **Neues Projekt erstellen:**
   - Repository deployen
   - Environment Variables setzen
3. **Domain:** Automatisch generierte .up.railway.app URL

### Environment Setup

#### Lokale Entwicklung
```bash
# Frontend .env.local
VITE_SERVER_URL=http://localhost:3001

# Backend .env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
# Optional nur lokal
ADMIN_PASSWORD=admin123
```

#### Produktion
```bash
# Frontend .env.production
VITE_SERVER_URL=https://your-backend.onrender.com

# Backend .env
PORT=10000
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
ADMIN_PASSWORD=your-strong-admin-password
```

### CORS-Konfiguration
Der Server ist bereits für mehrere Origins konfiguriert:
- Lokale Entwicklung: `localhost:5173`, `localhost:5174`, etc.
- Produktion: Ihre Deployment-URLs

### Troubleshooting

**Problem: Socket.IO Verbindung fehlgeschlagen**
- Prüfen Sie die `VITE_SERVER_URL` Environment Variable
- Stellen Sie sicher, dass CORS für Ihre Domain konfiguriert ist

**Problem: Admin Login funktioniert nicht**
- Prüfen Sie, ob `ADMIN_PASSWORD` in Ihrer Produktionsumgebung gesetzt ist
- Prüfen Sie Server-Logs für Fehler

**Problem: Teams können sich nicht registrieren**
- Prüfen Sie Socket.IO Verbindung
- Stellen Sie sicher, dass Backend läuft
 - Bei doppeltem Teamnamen wird die Registrierung freundlich gemeldet bzw. ein inaktives Team reaktiviert

### Für Tech Day vorbereiten

1. **Testen Sie beide Deployment-Optionen**
2. **Notieren Sie sich alle URLs:**
   - Frontend: `https://your-app.vercel.app`
   - Backend: `https://your-app.onrender.com`
3. **Testen Sie von verschiedenen Geräten:**
   - Desktop Browser
   - Mobile Browser
   - Verschiedene Netzwerke
4. **Backup-Plan:** Lokale Netzwerk-Freigabe als Fallback

### Monitoring
- **Frontend:** Vercel Analytics für Besucherzahlen
- **Backend:** Server-Logs auf Render/Railway
- **Echtzeit:** Socket.IO Verbindung überwachen

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License - see LICENSE file for details

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, Socket.io
- **UI**: Shadcn/ui, Lucide React icons
- **Charts**: Recharts
- **Animations**: Framer Motion

## Backend-URL konfigurieren

Die App verbindet sich via Socket.IO mit dem Backend. Setze die URL auf eine der folgenden Arten:

- Build-Zeit (Vite): `VITE_SERVER_URL` als Env-Variable setzen (z. B. Vercel Project Settings → Environment Variables).
- Laufzeit-Override im Browser (ohne Rebuild):
   - Global: `window.__APXO_SERVER_URL__ = 'https://api.example.com'` vor App-Initialisierung setzen.
   - Meta-Tag: `<meta name="apxo-server-url" content="https://api.example.com" />` in `index.html` (oder über die Hosting-Plattform injizieren).

Falls keine Einstellung vorhanden ist und die App lokal auf `localhost` läuft, wird automatisch `http://localhost:3001` verwendet.