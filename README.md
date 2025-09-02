# Airline Procurement & Demand Simulation (APXO)

A real-time, multi-user simulation game for learning airline revenue management and procurement strategies.

## Features

- **Multi-User Support**: Multiple teams can join simultaneously from different devices
- **Real-Time Updates**: Live synchronization of game state across all participants
- **Admin Control**: Centralized admin panel for managing game parameters and rounds
- **Team Registration**: Simple team registration system with unique team names
- **Round-Based Gameplay**: Timed rounds with automatic progression
- **Live Leaderboard**: Real-time standings and results
- **Responsive Design**: Works on desktop and mobile devices

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
4. Set your retail price and procurement quantities
5. Monitor your results and leaderboard in real-time

### For Admins
1. Open http://localhost:5173 in your browser
2. Click "Admin Login" and use password: `admin123`
3. Configure game parameters (demand, rounds, timing, etc.)
4. Start rounds and monitor all teams
5. View comprehensive admin dashboard with team decisions

## Game Mechanics

- **Procurement**: Teams buy seat capacity from different fare classes
- **Pricing**: Teams set retail prices for their seats
- **Demand**: Random customer demand based on willingness-to-pay (WTP) distribution
- **Competition**: In shared market mode, customers choose the cheapest available option
- **Profit Calculation**: Revenue minus procurement costs

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

## Deployment

### For Production
1. Build the frontend:
   ```bash
   npm run build
   ```

2. Set environment variables for the server:
   ```bash
   PORT=3001
   ADMIN_PASSWORD=your_secure_password
   ```

3. Deploy both frontend (dist/) and backend to your hosting platform

### Environment Variables
- `PORT`: Server port (default: 3001)
- `ADMIN_PASSWORD`: Admin login password (default: admin123)

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