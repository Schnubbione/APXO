import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
} else {
  dotenv.config();
}

const app = express();
const server = createServer(app);

// CORS configuration for both development and production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const staticAllowed = [
      // Local development
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "http://127.0.0.1:5175",
      // Known production frontend
      "https://apxo.vercel.app",
      "https://www.apxo.tech",
      "https://apxo.tech",
    ];

    const envFrontend = process.env.FRONTEND_URL; // e.g. https://apxo.vercel.app

    const allowedOrigins = envFrontend ? [...staticAllowed, envFrontend] : staticAllowed;

    let isAllowed = allowedOrigins.includes(origin);

    // Allow any *.vercel.app subdomain
    if (!isAllowed) {
      try {
        const hostname = new URL(origin).hostname;
        if (hostname.endsWith('.vercel.app')) {
          isAllowed = true;
        }
      } catch (e) {
        // ignore URL parse errors
      }
    }

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};

const io = new Server(server, {
  cors: corsOptions
});

app.use(cors(corsOptions));
// Handle preflight requests globally
app.options('*', cors(corsOptions));
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
  res.json({
    message: 'APXO Server is running!',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// In-memory storage (for development)
let gameState = {
  teams: [],
  currentRound: 0,
  totalRounds: 5,
  isActive: false,
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123', // Use environment variable
  baseDemand: 100,
  spread: 50,
  shock: 0.1,
  sharedMarket: true,
  seed: 42,
  roundTime: 300,
  // Economic parameters for realistic modeling
  priceElasticity: -1.5, // Price elasticity of demand
  crossElasticity: 0.3, // Cross-price elasticity between fare types
  costVolatility: 0.05, // Cost uncertainty (5%)
  demandVolatility: 0.1, // Demand uncertainty (10%)
  marketConcentration: 0.7, // Herfindahl-Hirschman Index approximation
  fares: [
    { code: 'F', label: 'Fix', cost: 60, demandFactor: 1.2 },
    { code: 'P', label: 'ProRata', cost: 85, demandFactor: 1.0 },
    { code: 'O', label: 'Pooling', cost: 110, demandFactor: 0.8 }
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
          buy: { F: 0, P: 0, O: 0 }
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

      // Store round data with additional economic metrics
      const roundData = {
        roundNumber: gameState.currentRound,
        timestamp: new Date().toISOString(),
        totalDemand: roundResults.reduce((sum, result) => sum + result.demand, 0),
        totalSold: roundResults.reduce((sum, result) => sum + result.sold, 0),
        avgPrice: roundResults.reduce((sum, result) => sum + (result.revenue / result.sold || 0), 0) / roundResults.length,
        totalRevenue: roundResults.reduce((sum, result) => sum + result.revenue, 0),
        totalCost: roundResults.reduce((sum, result) => sum + result.cost, 0),
        totalProfit: roundResults.reduce((sum, result) => sum + result.profit, 0),
        demandShock: generateNormalRandom(0, gameState.shock || 0.1),
        teamResults: roundResults
      };

      roundHistory.push(roundData);
      io.emit('roundEnded', { roundResults, roundNumber: gameState.currentRound });
      console.log(`Round ${gameState.currentRound} ended with ${roundData.totalSold} total sales`);
    }
  });

  // Get analytics data
  socket.on('getAnalytics', () => {
    socket.emit('analyticsData', {
      roundHistory: roundHistory,
      currentGameState: gameState,
      leaderboard: gameState.teams
        .map(team => ({
          name: team.name,
          profit: team.totalProfit,
          marketShare: calculateMarketShares()[team.id] || 0,
          avgPrice: calculateAveragePrice(team),
          capacity: calculateTeamCapacity(team)
        }))
        .sort((a, b) => b.profit - a.profit)
    });
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

// Helper function to calculate round results with realistic economic modeling
function calculateRoundResults() {
  const baseDemand = gameState.baseDemand || 100;
  const demandVolatility = gameState.demandVolatility || 0.1;

  // Generate stochastic demand shock using normal distribution
  const demandShock = generateNormalRandom(0, demandVolatility);

  // Calculate total market demand with stochastic variation and seasonal factors
  const seasonalFactor = 0.9 + Math.random() * 0.2; // Random between 0.9 and 1.1
  const totalDemand = Math.max(10, Math.round(baseDemand * (1 + demandShock) * seasonalFactor));

  // Calculate market shares based on economic principles
  const marketShares = calculateMarketShares();

  return gameState.teams.map(team => {
    const teamShare = marketShares[team.id] || 0;
    const teamDemand = Math.round(totalDemand * teamShare);

    // Calculate revenue based on actual sales and pricing
    const sold = Math.min(teamDemand, calculateTeamCapacity(team));
    const revenue = calculateRevenue(team, sold);

    // Calculate costs (fixed + variable costs)
    const cost = calculateCosts(team, sold);

    // Calculate profit with stochastic cost variations
    const profit = revenue - cost;

    // Update team's total profit
    team.totalProfit += profit;

    return {
      teamId: team.id,
      sold: sold,
      revenue: Math.round(revenue),
      cost: Math.round(cost),
      profit: Math.round(profit),
      unsold: Math.max(0, teamDemand - sold),
      marketShare: Math.round(teamShare * 100) / 100,
      demand: teamDemand,
      avgPrice: calculateAveragePrice(team),
      capacity: calculateTeamCapacity(team)
    };
  });
}

// Generate normal distributed random number using Box-Muller transform
function generateNormalRandom(mean = 0, stdDev = 1) {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z0 * stdDev + mean;
}

// Calculate market shares based on economic principles
function calculateMarketShares() {
  const teams = gameState.teams;
  const shares = {};

  if (teams.length === 0) return shares;

  // Calculate price competitiveness for each team using price elasticity
  const priceElasticity = gameState.priceElasticity || -1.5;
  const basePrice = 199; // Reference price

  const priceCompetitiveness = teams.map(team => {
    const avgPrice = calculateAveragePrice(team);
    // Price elasticity formula: demand = baseDemand * (price/basePrice)^elasticity
    const elasticityFactor = Math.pow(basePrice / avgPrice, priceElasticity);
    return Math.max(0.05, Math.min(3.0, elasticityFactor)); // Bound between 0.05 and 3.0
  });

  // Calculate capacity factor (more capacity = more market presence)
  const capacityFactors = teams.map(team => {
    const capacity = calculateTeamCapacity(team);
    return Math.max(0.1, Math.min(2.0, capacity / 50)); // Normalize around 50 capacity
  });

  // Combine price and capacity factors
  const combinedFactors = priceCompetitiveness.map((priceFactor, index) => {
    return priceFactor * capacityFactors[index];
  });

  // Calculate total combined competitiveness
  const totalCompetitiveness = combinedFactors.reduce((sum, factor) => sum + factor, 0);

  // Calculate market shares using logit choice model with stochastic variation
  teams.forEach((team, index) => {
    const rawShare = combinedFactors[index] / totalCompetitiveness;

    // Add stochastic variation using beta distribution approximation
    // Beta distribution parameters based on market concentration
    const concentration = gameState.marketConcentration || 0.7;
    const alpha = rawShare * (1 / concentration - 1);
    const beta_param = (1 - rawShare) * (1 / concentration - 1);

    // Simple approximation of beta distribution
    const stochasticFactor = 0.7 + Math.random() * 0.6; // Random between 0.7 and 1.3
    shares[team.id] = Math.max(0.01, Math.min(0.99, rawShare * stochasticFactor));
  });

  // Normalize shares to sum to 1
  const totalShares = Object.values(shares).reduce((sum, share) => sum + share, 0);
  Object.keys(shares).forEach(teamId => {
    shares[teamId] = shares[teamId] / totalShares;
  });

  return shares;
}

// Calculate average price weighted by purchased capacity
function calculateAveragePrice(team) {
  const decisions = team.decisions;
  const buy = decisions.buy || {};
  const fares = gameState.fares || [
    { code: 'F', cost: 60 },
    { code: 'P', cost: 85 },
    { code: 'O', cost: 110 }
  ];

  let totalCapacity = 0;
  let totalCost = 0;

  fares.forEach(fare => {
    const capacity = buy[fare.code] || 0;
    totalCapacity += capacity;
    totalCost += capacity * fare.cost;
  });

  if (totalCapacity === 0) return decisions.price || 199;

  const avgCost = totalCost / totalCapacity;
  return (decisions.price || 199) + avgCost;
}

// Calculate team's total capacity
function calculateTeamCapacity(team) {
  const buy = team.decisions.buy || {};
  return Object.values(buy).reduce((sum, capacity) => sum + (capacity || 0), 0);
}

// Calculate revenue based on sales and pricing strategy
function calculateRevenue(team, sold) {
  const price = team.decisions.price || 199;
  const buy = team.decisions.buy || {};

  // Revenue from passenger tickets
  const passengerRevenue = sold * price;

  // Additional revenue from unsold capacity (could be used for cargo, etc.)
  const totalCapacity = calculateTeamCapacity(team);
  const unsoldCapacity = Math.max(0, totalCapacity - sold);

  // Assume 20% of unsold capacity generates alternative revenue
  const alternativeRevenue = unsoldCapacity * 50; // $50 per unsold seat for alternative uses

  return passengerRevenue + alternativeRevenue;
}

// Calculate costs with fixed and variable components
function calculateCosts(team, sold) {
  const buy = team.decisions.buy || {};
  const fares = gameState.fares || [
    { code: 'F', cost: 60, demandFactor: 1.2 },
    { code: 'P', cost: 85, demandFactor: 1.0 },
    { code: 'O', cost: 110, demandFactor: 0.8 }
  ];

  let totalCost = 0;

  // Capacity acquisition costs
  fares.forEach(fare => {
    const capacity = buy[fare.code] || 0;
    totalCost += capacity * fare.cost;
  });

  // Fixed operational costs (independent of sales)
  const totalCapacity = calculateTeamCapacity(team);
  const fixedCosts = totalCapacity * 20; // $20 per seat for fixed costs

  // Variable costs based on actual operations
  const variableCosts = sold * 15; // $15 per passenger for variable costs

  // Stochastic cost variations using configured volatility
  const costVolatility = gameState.costVolatility || 0.05;
  const costMultiplier = 1 + generateNormalRandom(0, costVolatility);

  // Add economies of scale (lower costs per unit with higher capacity)
  const scaleFactor = Math.max(0.9, Math.min(1.0, 1 - (totalCapacity / 200) * 0.1));

  return (totalCost + fixedCosts + variableCosts) * costMultiplier * scaleFactor;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5175'}`);
});
