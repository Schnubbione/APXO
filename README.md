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

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Schnubbione/APXO.git
   cd APXO
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Start the backend server**
   ```bash
   cd server
   npm start
   ```
   The server will run on http://localhost:3001

5. **Start the frontend (in a new terminal)**
   ```bash
   npm run dev
   ```
   The app will be available at http://localhost:5173

## How to Play

### For Teams
1. Open http://localhost:5173 in your browser
2. Enter your unique team name
3. Wait for the admin to start the round
4. **Phase 1**: Make strategic fix seat purchases under information asymmetry (you won't see exact availability!)
5. **Phase 2**: Set customer prices and pooling allocation based on market intelligence
6. Monitor your results and leaderboard in real-time
7. **Strategic Challenge**: Balance guaranteed capacity vs. flexible options without complete information

### For Admins
1. Open http://localhost:5173 in your browser
2. Click "Admin Login" and use password: `admin123`
3. Configure game parameters (demand, rounds, timing, etc.)
4. Start rounds and monitor all teams
5. View comprehensive admin dashboard with team decisions

## Procurement Products

The simulation features three different procurement products with varying risk profiles:

- **Fix (€60/seat)**: Cheapest option, but must be paid regardless of demand. Lowest risk for airline, highest risk for tour operator. **Strategic consideration**: Limited availability creates competition - you won't know exact numbers!
- **ProRata (€85/seat)**: More expensive, but can be returned until 60 days before departure if not booked. Medium risk for both parties.
- **Pooling (€110/seat)**: Highest price, daily price and availability updates, not guaranteed, only paid if actual demand exists. Highest risk for airline, lowest risk for tour operator.

**Key Strategic Element**: Fix seats are purchased under information asymmetry - teams see market intelligence but not exact availability, promoting strategic decision-making and risk assessment.

## Game Mechanics

- **Procurement**: Teams buy seat capacity using different risk products
- **Pricing**: Teams set retail prices for their seats
- **Demand**: Random customer demand based on willingness-to-pay (WTP) distribution
- **Competition**: In shared market mode, customers choose the cheapest available option
- **Profit Calculation**: Revenue minus procurement costs (depending on product type and actual demand)
- **Information Asymmetry**: Teams don't see exact available fix seat capacity, only market intelligence
- **Strategic Decision-Making**: Balance risk vs. reward under uncertainty
- **Market Intelligence**: Real-time competitor analysis and capacity insights

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Real-time Communication**: WebSocket connections for live updates
- **State Management**: React Context for game state
- **UI Components**: Shadcn/ui component library

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
```

#### Produktion
```bash
# Frontend .env.production
VITE_SERVER_URL=https://your-backend.onrender.com

# Backend .env
PORT=10000
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
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
- Standard-Passwort: `admin123`
- Prüfen Sie Server-Logs für Fehler

**Problem: Teams können sich nicht registrieren**
- Prüfen Sie Socket.IO Verbindung
- Stellen Sie sicher, dass Backend läuft

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