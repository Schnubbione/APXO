import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './database.js';
import { syncDatabase } from './models.js';
import GameService from './gameService.js';

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

// Initialize database and start server
async function initializeServer() {
  try {
    // Test database connection
    await testConnection();

    // Sync database models
    await syncDatabase();

    // Sanitize any persisted settings that might contain legacy secrets
    try {
      const session = await GameService.getCurrentGameSession();
      if (session?.settings && Object.prototype.hasOwnProperty.call(session.settings, 'adminPassword')) {
        const { adminPassword, ...safeSettings } = session.settings;
        await session.update({ settings: safeSettings });
        console.log('🧹 Removed legacy adminPassword from persisted settings');
      }
    } catch (e) {
      console.warn('Warning while sanitizing persisted settings:', e?.message || e);
    }

    console.log('🚀 Server initialized with database connection');

    // Start the server
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5175'}`);
    });

  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Global variables for current session state (cached for performance)
let currentGameState = null;
let adminSocket = null;
let poolingMarketInterval = null; // For periodic pooling market updates

// Start periodic pooling market updates
function startPoolingMarketUpdates() {
  // Clear any existing interval
  if (poolingMarketInterval) {
    clearInterval(poolingMarketInterval);
  }

  // Get current settings for update interval (default to 1 second if not set)
  const updateInterval = 1000; // 1 second = 1 day

  // Update pooling market every configured interval during simulation
  poolingMarketInterval = setInterval(async () => {
    try {
      const session = await GameService.getCurrentGameSession();
      if (session.settings?.currentPhase === 'simulation' && session.isActive) {
        await GameService.updatePoolingMarket();
        await broadcastGameState();
      } else {
        // Stop updates if simulation is no longer active
        stopPoolingMarketUpdates();
      }
    } catch (error) {
      console.error('Error updating pooling market:', error);
    }
  }, updateInterval); // 1 second = 1 day

  console.log(`🏊 Pooling market updates started (every ${updateInterval/1000} second = 1 day)`);
}

// Stop pooling market updates
function stopPoolingMarketUpdates() {
  if (poolingMarketInterval) {
    clearInterval(poolingMarketInterval);
    poolingMarketInterval = null;
    console.log('🏊 Pooling market updates stopped');
  }
}

// Broadcast game state helper function
async function broadcastGameState() {
  try {
    const gameSession = await GameService.getCurrentGameSession();
    const activeTeams = await GameService.getActiveTeams();

    // Ensure sensitive settings never leak to clients and hide availability before allocation
    const sanitizeSettings = (settings) => {
      if (!settings || typeof settings !== 'object') return {};
      const { adminPassword, ...rest } = settings; // drop any legacy leak
      const allocationDone = !!rest.fixSeatsAllocated;
      // Before allocation, do not reveal exact remaining availability
      if (!allocationDone) {
        const { availableFixSeats, ...safe } = rest;
        return safe;
      }
      return rest;
    };

    // Get list of all connected sockets
    const connectedSockets = await io.fetchSockets();

    // Send personalized game state to each client
    for (const socket of connectedSockets) {
  const gameState = {
        teams: activeTeams.map(team => {
          if (team.socketId !== socket.id) {
            // Hide fix seat purchases from other teams
            return {
              id: team.id,
              name: team.name,
              decisions: {
                ...team.decisions,
                fixSeatsPurchased: undefined, // Hide from other teams
                // Before allocation, also hide any allocated amounts
                fixSeatsAllocated: (gameSession.settings?.fixSeatsAllocated ? team.decisions?.fixSeatsAllocated : undefined)
              },
              totalProfit: team.totalProfit
            };
          } else {
            // Show full data for own team
            return {
              id: team.id,
              name: team.name,
              decisions: {
                ...team.decisions,
                // Before allocation, ensure allocated is not prematurely inferred
                fixSeatsAllocated: (gameSession.settings?.fixSeatsAllocated ? team.decisions?.fixSeatsAllocated : undefined)
              },
              totalProfit: team.totalProfit
            };
          }
        }),
        currentRound: gameSession.currentRound,
        totalRounds: gameSession.totalRounds,
  isActive: gameSession.isActive,
  ...sanitizeSettings(gameSession.settings),
        fares: [
          { code: 'F', label: 'Fix', cost: 60, demandFactor: 1.2 },
          { code: 'P', label: 'ProRata', cost: 85, demandFactor: 1.0 },
          { code: 'O', label: 'Pooling', cost: 110, demandFactor: 0.8 }
        ]
      };

      socket.emit('gameStateUpdate', gameState);
    }
  } catch (error) {
    console.error('Error broadcasting game state:', error);
  }
}

// Socket.io connection handling
io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  try {
    // Get current game state from database with privacy filtering
    const gameSession = await GameService.getCurrentGameSession();
    const activeTeams = await GameService.getActiveTeams();

    // Ensure sensitive settings never leak to clients and hide availability before allocation
    const sanitizeSettings = (settings) => {
      if (!settings || typeof settings !== 'object') return {};
      const { adminPassword, ...rest } = settings; // drop any legacy leak
      const allocationDone = !!rest.fixSeatsAllocated;
      // Before allocation, do not reveal exact remaining availability
      if (!allocationDone) {
        const { availableFixSeats, ...safe } = rest;
        return safe;
      }
      return rest;
    };

    // Prepare game state for this specific client
  const gameState = {
      teams: activeTeams.map(team => {
        if (team.socketId !== socket.id) {
          // Hide fix seat purchases from other teams
          return {
            id: team.id,
            name: team.name,
            decisions: {
              ...team.decisions,
              fixSeatsPurchased: undefined, // Hide from other teams
              fixSeatsAllocated: (gameSession.settings?.fixSeatsAllocated ? team.decisions?.fixSeatsAllocated : undefined)
            },
            totalProfit: team.totalProfit
          };
        } else {
          // Show full data for own team
          return {
            id: team.id,
            name: team.name,
            decisions: {
              ...team.decisions,
              fixSeatsAllocated: (gameSession.settings?.fixSeatsAllocated ? team.decisions?.fixSeatsAllocated : undefined)
            },
            totalProfit: team.totalProfit
          };
        }
      }),
      currentRound: gameSession.currentRound,
      totalRounds: gameSession.totalRounds,
  isActive: gameSession.isActive,
  ...sanitizeSettings(gameSession.settings),
      fares: [
        { code: 'F', label: 'Fix', cost: 60, demandFactor: 1.2 },
        { code: 'P', label: 'ProRata', cost: 85, demandFactor: 1.0 },
        { code: 'O', label: 'Pooling', cost: 110, demandFactor: 0.8 }
      ]
    };

    // Send current game state to new connection
    socket.emit('gameState', gameState);

  } catch (error) {
    console.error('Error loading game state:', error);
    socket.emit('error', 'Failed to load game state');
  }

  // Team registration
  socket.on('registerTeam', async (teamName) => {
    try {
      const team = await GameService.registerTeam(socket.id, teamName);

      socket.emit('registrationSuccess', {
        id: team.id,
        name: team.name,
        decisions: team.decisions,
        totalProfit: team.totalProfit
      });

      // Broadcast updated game state to all clients
      await broadcastGameState();

      console.log(`Team registered: ${teamName}`);
    } catch (error) {
      socket.emit('registrationError', error.message);
    }
  });

    // Admin login
  socket.on('adminLogin', async (password) => {
  const expectedPassword = process.env.ADMIN_PASSWORD || process.env.APP_PASSWORD;
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, ADMIN_PASSWORD must be set
    if (isProduction && !expectedPassword) {
      console.error('SECURITY ERROR: ADMIN_PASSWORD environment variable not set in production!');
      socket.emit('adminLoginError', 'Admin login is not configured');
      return;
    }

    // In development, use default password if not set
  const finalPassword = expectedPassword || (isProduction ? null : 'admin123');

    if (!finalPassword) {
      socket.emit('adminLoginError', 'Admin login is not configured');
      return;
    }

    console.log('Admin login attempt:', {
      provided: password,
      expected: finalPassword,
      env: expectedPassword ? (process.env.ADMIN_PASSWORD ? 'ADMIN_PASSWORD' : 'APP_PASSWORD') : 'not set',
      environment: process.env.NODE_ENV || 'development'
    });

    if (password === finalPassword) {
      adminSocket = socket.id;

      // Update admin socket in database
      const session = await GameService.getCurrentGameSession();
      await session.update({ adminSocketId: socket.id });

      socket.emit('adminLoginSuccess');
      console.log('Admin logged in successfully');
    } else {
      socket.emit('adminLoginError', 'Invalid password');
      console.log('Admin login failed - invalid password');
    }
  });

  // Admin actions
  socket.on('updateGameSettings', async (settings) => {
    if (socket.id === adminSocket) {
      try {
        await GameService.updateGameSettings(settings);
        await broadcastGameState();
        console.log('Game settings updated');
      } catch (error) {
        console.error('Error updating game settings:', error);
        socket.emit('error', 'Failed to update game settings');
      }
    }
  });

  // Team decisions
  socket.on('updateTeamDecision', async (decision) => {
    try {
      const team = await GameService.updateTeamDecision(socket.id, decision);
      if (team) {
        await broadcastGameState();

        // If this is a price change during simulation, trigger immediate market update
        if (decision.price !== undefined) {
          const session = await GameService.getCurrentGameSession();
          if (session.settings?.currentPhase === 'simulation' && session.isActive) {
            await GameService.updatePoolingMarket();
            await broadcastGameState();
          }
        }
      }
    } catch (error) {
      console.error('Error updating team decision:', error);
      socket.emit('error', 'Failed to update team decision');
    }
  });

  // Start round (admin only)
  socket.on('startRound', async () => {
    if (socket.id === adminSocket) {
      try {
        const newRound = await GameService.startRound();
        io.emit('roundStarted', newRound);
        await broadcastGameState();
        console.log(`Round ${newRound} started`);
      } catch (error) {
        console.error('Error starting round:', error);
        socket.emit('error', 'Failed to start round');
      }
    }
  });

  // End round (admin only)
  socket.on('endRound', async () => {
    if (socket.id === adminSocket) {
      try {
        const session = await GameService.getCurrentGameSession();

        // If this is the first round and fix seats haven't been allocated yet, allocate them now
        if (session.currentRound === 0 && !(session.settings?.fixSeatsAllocated)) {
          console.log('🎯 Allocating fix seats at end of first round...');
          const allocationResult = await GameService.allocateFixSeats();

          // Broadcast allocation results to all clients
          io.emit('fixSeatsAllocated', allocationResult);
          console.log('✅ Fix seats allocation completed');
        }

        const roundResults = await GameService.endRound(calculateRoundResults);
        const updatedSession = await GameService.getCurrentGameSession();

        io.emit('roundEnded', { roundResults, roundNumber: updatedSession.currentRound });
        await broadcastGameState();
        console.log(`Round ${updatedSession.currentRound} ended with ${roundResults.reduce((sum, r) => sum + r.sold, 0)} total sales`);

        // Stop pooling market updates when round ends
        stopPoolingMarketUpdates();
      } catch (error) {
        console.error('Error ending round:', error);
        socket.emit('error', 'Failed to end round');
      }
    }
  });

  // Start pre-purchase phase (admin only)
  socket.on('startPrePurchasePhase', async () => {
    if (socket.id === adminSocket) {
      try {
        await GameService.startPrePurchasePhase();
        io.emit('phaseStarted', 'prePurchase');
        await broadcastGameState();
        console.log('Pre-purchase phase started');
      } catch (error) {
        console.error('Error starting pre-purchase phase:', error);
        socket.emit('error', 'Failed to start pre-purchase phase');
      }
    }
  });

  // Start simulation phase (admin only)
  socket.on('startSimulationPhase', async () => {
    if (socket.id === adminSocket) {
      try {
        await GameService.startSimulationPhase();
        io.emit('phaseStarted', 'simulation');
        await broadcastGameState();
        console.log('Simulation phase started');

        // Start pooling market updates
        startPoolingMarketUpdates();
      } catch (error) {
        console.error('Error starting simulation phase:', error);
        socket.emit('error', 'Failed to start simulation phase');
      }
    }
  });

  // End current phase (admin only)
  socket.on('endPhase', async () => {
    if (socket.id === adminSocket) {
      try {
        await GameService.endPhase();
        io.emit('phaseEnded');
        await broadcastGameState();
        console.log('Current phase ended');

        // Stop pooling market updates when phase ends
        stopPoolingMarketUpdates();
      } catch (error) {
        console.error('Error ending phase:', error);
        socket.emit('error', 'Failed to end phase');
      }
    }
  });

  // Run simulation (admin only)
  socket.on('runSimulation', async () => {
    if (socket.id === adminSocket) {
      try {
        const simulationResults = await runMonthlySimulation();
        io.emit('simulationResults', simulationResults);
        await broadcastGameState();
        console.log('Simulation completed');
      } catch (error) {
        console.error('Error running simulation:', error);
        socket.emit('error', 'Failed to run simulation');
      }
    }
  });

  // Reset all game data (admin only)
  socket.on('resetAllData', async () => {
    if (socket.id === adminSocket) {
      try {
        console.log('🔄 Admin resetting all game data...');
        const result = await GameService.resetAllData();

        // Broadcast reset confirmation to all clients
        io.emit('dataReset', {
          message: 'All game data has been reset by admin',
          timestamp: new Date().toISOString()
        });

        // Broadcast fresh game state
        await broadcastGameState();

        socket.emit('resetComplete', result);
        console.log('✅ All game data reset successfully');
      } catch (error) {
        console.error('❌ Error resetting data:', error);
        socket.emit('error', 'Failed to reset game data');
      }
    } else {
      socket.emit('error', 'Unauthorized: Admin access required');
    }
  });

  // Reset current game (keep high scores)
  socket.on('resetCurrentGame', async () => {
    if (socket.id === adminSocket) {
      try {
        console.log('🔄 Admin resetting current game (keeping high scores)...');
        const result = await GameService.resetCurrentGame();

        // Broadcast reset confirmation to all clients
        io.emit('currentGameReset', {
          message: 'Current game has been reset by admin. High scores are preserved.',
          timestamp: new Date().toISOString()
        });

        // Broadcast fresh game state
        await broadcastGameState();

        socket.emit('resetComplete', result);
        console.log('✅ Current game reset successfully (high scores preserved)');
      } catch (error) {
        console.error('❌ Error resetting current game:', error);
        socket.emit('error', 'Failed to reset current game');
      }
    } else {
      socket.emit('error', 'Unauthorized: Admin access required');
    }
  });

  // Get analytics data
  socket.on('getAnalytics', async () => {
    try {
      const analyticsData = await GameService.getAnalyticsData();
      socket.emit('analyticsData', analyticsData);
    } catch (error) {
      console.error('Error getting analytics data:', error);
      socket.emit('error', 'Failed to get analytics data');
    }
  });

  // Broadcast game state to all clients
  socket.on('broadcastGameState', async () => {
    try {
      const gameState = await GameService.getCurrentGameState();
      io.emit('gameStateUpdate', gameState);
    } catch (error) {
      console.error('Error broadcasting game state:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);

    try {
      // Remove team from database if they disconnect
      await GameService.removeTeam(socket.id);

      // Clear admin socket if admin disconnects
      if (adminSocket === socket.id) {
        adminSocket = null;
        const session = await GameService.getCurrentGameSession();
        await session.update({ adminSocketId: null });
      }

      // Broadcast updated game state
      await broadcastGameState();
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Run monthly simulation for 12 months
async function runMonthlySimulation() {
  const session = await GameService.getCurrentGameSession();
  const teams = await GameService.getActiveTeams();
  const settings = session.settings || {};

  const simulationMonths = settings.simulationMonths || 12;
  const departureDate = new Date(settings.departureDate || Date.now() + 12 * 30 * 24 * 60 * 60 * 1000);
  const currentDate = new Date();

  const monthlyResults = [];

  for (let month = 1; month <= simulationMonths; month++) {
    const monthDate = new Date(currentDate.getTime() + month * 30 * 24 * 60 * 60 * 1000);
    const monthsToDeparture = Math.max(0, Math.ceil((departureDate.getTime() - monthDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));

    // Calculate demand based on months to departure (higher demand closer to departure)
    const baseDemand = settings.baseDemand || 100;
    const demandMultiplier = Math.max(0.5, Math.min(2.0, 1 + (12 - monthsToDeparture) / 12));
    const monthlyDemand = Math.round(baseDemand * demandMultiplier);

    // Calculate results for this month
    const monthResults = calculateMonthlyResults(teams, settings, monthlyDemand, monthsToDeparture);

    monthlyResults.push({
      month,
      date: monthDate.toISOString(),
      monthsToDeparture,
      totalDemand: monthlyDemand,
      teamResults: monthResults
    });

    // Small delay to simulate real-time progression (1 second per month for 365-day simulation)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Update team profits based on simulation results
  for (const team of teams) {
    const teamMonthlyProfits = monthlyResults.map(m => {
      const teamResult = m.teamResults.find(r => r.teamId === team.id);
      return teamResult ? teamResult.profit : 0;
    });

    const totalSimulationProfit = teamMonthlyProfits.reduce((sum, profit) => sum + profit, 0);
    const newTotalProfit = parseFloat(team.totalProfit || 0) + totalSimulationProfit;

    await team.update({ totalProfit: newTotalProfit });
  }

  return {
    monthlyResults,
    totalSimulationProfit: monthlyResults.reduce((sum, month) => sum + month.teamResults.reduce((teamSum, team) => teamSum + team.profit, 0), 0)
  };
}

// Calculate results for a specific month
function calculateMonthlyResults(teams, settings, monthlyDemand, monthsToDeparture) {
  // Calculate market shares based on team strategies
  const marketShares = calculateMarketShares(teams, settings);

  return teams.map(team => {
    const teamShare = marketShares[team.id] || 0;
    const teamDemand = Math.round(monthlyDemand * teamShare);

    // Calculate available capacity (fix seats + pooling allocation)
    const fixSeats = team.decisions.fixSeatsPurchased || 0;
    const poolingAllocation = (team.decisions.poolingAllocation || 0) / 100;
    const totalPoolingCapacity = Math.round(settings.totalCapacity * poolingAllocation);
    const availableCapacity = fixSeats + totalPoolingCapacity;

    // Calculate actual sales
    const sold = Math.min(teamDemand, availableCapacity);
  const price = team.decisions.price || 199;

    // Revenue from passenger sales
    const passengerRevenue = sold * price;

    // Costs
    const fixSeatCost = fixSeats * (settings.fixSeatPrice || 60);
    const poolingCost = totalPoolingCapacity * (settings.poolingCost || 30); // Assume pooling cost
    const operationalCost = sold * 15; // Variable operational costs

    const totalCost = fixSeatCost + poolingCost + operationalCost;
    const profit = passengerRevenue - totalCost;

    return {
      teamId: team.id,
      teamName: team.name,
      demand: teamDemand,
      sold,
      capacity: availableCapacity,
      price,
      revenue: Math.round(passengerRevenue),
      cost: Math.round(totalCost),
      profit: Math.round(profit),
      marketShare: Math.round(teamShare * 100) / 100,
      unsold: Math.max(0, teamDemand - sold)
    };
  });
}

// Helper function to calculate round results with realistic economic modeling
function calculateRoundResults(teams, settings) {
  const baseDemand = settings.baseDemand || 100;
  const demandVolatility = settings.demandVolatility || 0.1;

  // Stochastic demand shock and seasonal factor
  const demandShock = generateNormalRandom(0, demandVolatility);
  const seasonalFactor = 0.9 + Math.random() * 0.2; // 0.9..1.1

  // Capacity-weighted market price index
  const basePrice = 199;
  const capacities = teams.map(t => calculateTeamCapacity(t, settings));
  const totalCapacity = Math.max(1, capacities.reduce((a, b) => a + b, 0));
  const weightedPriceSum = teams.reduce((sum, team, i) => sum + (getRetailPrice(team) * (capacities[i] || 0)), 0);
  const marketWeightedPrice = weightedPriceSum / totalCapacity;
  const priceIndex = Math.max(0.5, Math.min(1.5, (marketWeightedPrice || basePrice) / basePrice));
  const marketPriceElasticity = (typeof settings.marketPriceElasticity === 'number')
    ? settings.marketPriceElasticity
    : ((typeof settings.priceElasticity === 'number' ? settings.priceElasticity * 0.6 : -0.9));

  // Total market demand reacts to overall price level
  const demandBase = baseDemand * (1 + demandShock) * seasonalFactor;
  const totalDemand = Math.max(10, Math.round(demandBase * Math.pow(priceIndex, marketPriceElasticity)));

  // Market shares based on price and capacity (incl. pooling)
  const marketShares = calculateMarketShares(teams, settings);

  return teams.map((team, idx) => {
    const teamShare = marketShares[team.id] || 0;
    const teamDemand = Math.round(totalDemand * teamShare);

    const capacity = calculateTeamCapacity(team, settings);
    const sold = Math.min(teamDemand, capacity);
    const revenue = calculateRevenue(team, sold);
    const cost = calculateCosts(team, sold, settings);
    const profit = revenue - cost;

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
      capacity: capacity
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
function calculateMarketShares(teams, settings) {
  const shares = {};

  if (teams.length === 0) return shares;

  // Calculate price competitiveness for each team using price elasticity
  const priceElasticity = settings.priceElasticity || -1.5;
  const basePrice = 199; // Reference price (retail)

  const priceCompetitiveness = teams.map(team => {
    const retailPrice = getRetailPrice(team);
    // Correct elasticity: demand ∝ (price/basePrice)^elasticity with elasticity < 0
    const ratio = Math.max(0.1, Math.min(3.0, (retailPrice || basePrice) / basePrice));
    const elasticityFactor = Math.pow(ratio, priceElasticity);
    return Math.max(0.05, Math.min(3.0, elasticityFactor)); // Bound
  });

  // Calculate capacity factor (more capacity = more market presence)
  const capacityFactors = teams.map(team => {
    const capacity = calculateTeamCapacity(team, settings);
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
  const concentration = settings.marketConcentration || 0.7;
  // Simple stochastic variation (implicit cross-effects)
  const stochasticFactor = 0.85 + Math.random() * 0.3; // 0.85..1.15, weniger Rauschen
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
function getRetailPrice(team) {
  return team?.decisions?.price || 199;
}

function calculateAveragePrice(team) {
  // For reporting: average price the customer pays is the retail price
  return getRetailPrice(team);
}

// Calculate team's total capacity
function calculateTeamCapacity(team, settings = {}) {
  const buy = team.decisions.buy || {};
  const purchased = Object.values(buy).reduce((sum, capacity) => sum + (capacity || 0), 0);
  const poolingAllocation = (team.decisions.poolingAllocation || 0) / 100;
  const totalCapacity = settings.totalCapacity || 1000;
  const poolingCapacity = Math.round(totalCapacity * poolingAllocation);
  return purchased + poolingCapacity;
}

// Calculate revenue based on sales and pricing strategy
function calculateRevenue(team, sold) {
  const price = team.decisions.price || 199;
  // Revenue from passenger tickets only; no extra revenue for unsold seats
  return sold * price;
}

// Calculate costs with fixed and variable components
function calculateCosts(team, sold, settings = {}) {
  const buy = team.decisions.buy || {};
  const fares = [
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

  // Pooling usage costs: pay per used pooled seat at current pooling price
  const totalCapacitySetting = settings.totalCapacity || 1000;
  const poolingAllocation = (team.decisions.poolingAllocation || 0) / 100;
  const poolingCapacity = Math.round(totalCapacitySetting * poolingAllocation);
  const fixSeats = team.decisions.fixSeatsPurchased || 0;
  // Roughly assume pooled seats are used after fix seats
  const pooledUsed = Math.max(0, Math.min(poolingCapacity, sold - Math.min(sold, fixSeats)));
  const poolingUnitCost = (settings.poolingMarket && typeof settings.poolingMarket.currentPrice === 'number')
    ? settings.poolingMarket.currentPrice
    : (typeof settings.poolingCost === 'number' ? settings.poolingCost : 30);
  const poolingUsageCost = pooledUsed * poolingUnitCost;

  // Hotel capacity costs: empty beds are a cost (per rule). Beds assigned at phase start.
  const hotelCapacity = team.decisions.hotelCapacity || 0;
  const hotelBedCost = typeof settings.hotelBedCost === 'number' ? settings.hotelBedCost : 50;
  const usedBeds = Math.min(sold, hotelCapacity);
  const emptyBeds = Math.max(0, hotelCapacity - usedBeds);
  const hotelEmptyBedCost = emptyBeds * hotelBedCost;

  // Stochastic cost variations using configured volatility
  const costVolatility = typeof settings.costVolatility === 'number' ? settings.costVolatility : 0.05;
  const costMultiplier = 1 + generateNormalRandom(0, costVolatility);

  // Add economies of scale (lower costs per unit with higher capacity)
  const scaleFactor = Math.max(0.85, Math.min(1.0, 1 - (totalCapacity / 200) * 0.1));

  return (totalCost + fixedCosts + variableCosts + poolingUsageCost + hotelEmptyBedCost) * costMultiplier * scaleFactor;
}

const PORT = process.env.PORT || 3001;

// Start the server with database initialization
initializeServer();
