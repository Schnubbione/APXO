import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);

// CORS configuration for both development and production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      // Local development
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "http://127.0.0.1:5175",
      // Production frontend (will be updated with actual URL)
      process.env.FRONTEND_URL || "https://your-frontend-url.vercel.app"
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST"],
  credentials: true
};

const io = new Server(server, {
  cors: corsOptions
});

app.use(cors(corsOptions));
app.use(express.json());

// In-memory storage (for development)
let gameState = {
  teams: [],
  currentRound: 0,
  totalRounds: 5,
  isActive: false,
  adminPassword: 'admin123', // In production, use environment variables
  baseDemand: 100,
  spread: 50,
  shock: 0.1,
  sharedMarket: true,
  seed: 42,
  roundTime: 300,
  fares: [
    { code: 'F', label: 'Fix', cost: 60 },
    { code: 'P', label: 'ProRata', cost: 85 },
    { code: 'O', label: 'Pooling', cost: 110 }
  ]
};

let roundHistory = [];
let adminSocket = null;

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send current game state to new connection
  socket.emit('gameState', gameState);

  // Team registration
  socket.on('registerTeam', (teamName) => {
    if (!gameState.teams.find(t => t.name === teamName)) {
      const newTeam = {
        id: socket.id,
        name: teamName,
        decisions: {
          price: 199,
          buy: {}
        },
        totalProfit: 0
      };
      gameState.teams.push(newTeam);
      socket.emit('registrationSuccess', newTeam);
      io.emit('gameState', gameState);
      console.log(`Team registered: ${teamName}`);
    } else {
      socket.emit('registrationError', 'Team name already taken');
    }
  });

  // Admin login
  socket.on('adminLogin', (password) => {
    if (password === gameState.adminPassword) {
      adminSocket = socket.id;
      socket.emit('adminLoginSuccess');
      console.log('Admin logged in');
    } else {
      socket.emit('adminLoginError', 'Invalid password');
    }
  });

  // Admin actions
  socket.on('updateGameSettings', (settings) => {
    if (socket.id === adminSocket) {
      gameState = { ...gameState, ...settings };
      io.emit('gameState', gameState);
      console.log('Game settings updated');
    }
  });

  // Team decisions
  socket.on('updateTeamDecision', (decision) => {
    const team = gameState.teams.find(t => t.id === socket.id);
    if (team) {
      team.decisions = { ...team.decisions, ...decision };
      io.emit('gameState', gameState);
    }
  });

  // Start round (admin only)
  socket.on('startRound', () => {
    if (socket.id === adminSocket && !gameState.isActive) {
      gameState.isActive = true;
      gameState.currentRound++;
      io.emit('roundStarted', gameState.currentRound);
      console.log(`Round ${gameState.currentRound} started`);
    }
  });

  // End round (admin only)
  socket.on('endRound', () => {
    if (socket.id === adminSocket && gameState.isActive) {
      gameState.isActive = false;
      // Calculate round results
      const roundResults = calculateRoundResults();
      roundHistory.push(roundResults);
      io.emit('roundEnded', { roundResults, roundNumber: gameState.currentRound });
      console.log(`Round ${gameState.currentRound} ended`);
    }
  });

  // Get leaderboard
  socket.on('getLeaderboard', () => {
    const leaderboard = gameState.teams
      .map(team => ({
        name: team.name,
        profit: team.totalProfit
      }))
      .sort((a, b) => b.profit - a.profit);
    socket.emit('leaderboard', leaderboard);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove team if they disconnect
    gameState.teams = gameState.teams.filter(t => t.id !== socket.id);
    if (adminSocket === socket.id) {
      adminSocket = null;
    }
    io.emit('gameState', gameState);
  });
});

// Helper function to calculate round results
function calculateRoundResults() {
  // Simplified calculation - you can expand this based on your existing logic
  return gameState.teams.map(team => ({
    teamId: team.id,
    sold: Math.floor(Math.random() * 50) + 10, // Random for demo
    revenue: Math.floor(Math.random() * 5000) + 1000,
    cost: Math.floor(Math.random() * 3000) + 500,
    profit: Math.floor(Math.random() * 2000) - 500,
    unsold: Math.floor(Math.random() * 20)
  }));
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5175'}`);
});
