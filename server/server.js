import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './database.js';
import { syncDatabase, Team } from './models.js';
import GameService from './gameService.js';
import { calculateRoundResults, calculateMarketShares } from './calc.js';

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
let roundTimerInterval = null; // For round timer countdown
let remainingTime = 0; // Remaining time in seconds

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

// Start round timer countdown
function startRoundTimer() {
  // Clear any existing timer
  if (roundTimerInterval) {
    clearInterval(roundTimerInterval);
  }

  // Get current session and settings
  const session = GameService.currentGameSession;
  if (!session) {
    console.error('No active session found for timer');
    return;
  }

  const settings = session.settings || {};
  const currentPhase = settings.currentPhase;

  // Get phase time from settings (Pre-Purchase uses roundTime, Simulation has no timer)
  let roundTime;
  if (currentPhase === 'prePurchase') {
    roundTime = settings.roundTime || 600; // Use roundTime for pre-purchase phase
  } else if (currentPhase === 'simulation') {
    // Simulation phase has no timer - controlled by Pooling Market Update Interval and Simulated Days per Update
    roundTime = null;
  } else {
    roundTime = 300; // Fallback
  }

  remainingTime = roundTime;

  // Only start timer if roundTime is set (Pre-Purchase phase)
  if (roundTime !== null) {
    // Update timer every second
    roundTimerInterval = setInterval(async () => {
      try {
        remainingTime = Math.max(0, remainingTime - 1);

        // Broadcast updated time to all clients
        await broadcastGameState();

        // If time is up, automatically end the phase
        if (remainingTime <= 0) {
          console.log(`⏰ ${currentPhase} phase time is up! Auto-ending phase...`);
          await autoEndCurrentPhase();
        }
      } catch (error) {
        console.error('Error updating round timer:', error);
      }
    }, 1000);

    console.log(`⏰ ${currentPhase} phase timer started (${roundTime} seconds)`);
  } else {
    console.log(`⏰ ${currentPhase} phase has no timer - controlled by Pooling Market settings`);
  }
}

// Stop round timer
function stopRoundTimer() {
  if (roundTimerInterval) {
    clearInterval(roundTimerInterval);
    roundTimerInterval = null;
    console.log('⏰ Round timer stopped');
  }
}

// Auto-end current phase when timer runs out
async function autoEndCurrentPhase() {
  try {
    const session = await GameService.getCurrentGameSession();

    // Validate that a phase is actually running
    if (!session.isActive) {
      console.log('No active phase to auto-end');
      stopRoundTimer();
      return;
    }

    const currentPhase = session.settings?.currentPhase;
    console.log(`🔄 Auto-ending ${currentPhase} phase...`);

    // Handle different phase endings
    if (currentPhase === 'prePurchase') {
      // End of Pre-Purchase Phase: Allocate fix seats
      console.log('🎯 Auto-allocating fix seats at end of pre-purchase phase...');
      const allocationResult = await GameService.allocateFixSeats();

      // Broadcast allocation results to all clients
      io.emit('fixSeatsAllocated', allocationResult);
      console.log('✅ Fix seats auto-allocation completed');
    } else if (currentPhase === 'simulation') {
      // End of Simulation Phase: Final evaluation and achievements
      console.log('🏆 Auto-ending simulation phase - evaluating final results and achievements...');

      // Broadcast final phase completion
      io.emit('finalPhaseCompleted', {
        message: 'Simulation phase completed! Achievements will be evaluated.',
        phaseNumber: 2
      });
    }

    // End the current phase
    await GameService.endPhase();

    // Calculate and save results if this is the simulation phase
    if (currentPhase === 'simulation') {
      const endRes = await GameService.endRound(calculateRoundResults);
      const updatedSession = await GameService.getCurrentGameSession();

      io.emit('roundEnded', {
        roundResults: endRes.results,
        phaseNumber: 2,
        isFinalPhase: true,
        currentRound: endRes.currentRound,
        isGameComplete: endRes.isGameComplete
      });

      console.log(`Simulation phase auto-ended with ${endRes.results.reduce((sum, r) => sum + r.sold, 0)} total sales`);
    } else {
      // For pre-purchase phase, just broadcast phase ended
      io.emit('phaseEnded', {
        phaseNumber: 1,
        isFinalPhase: false
      });
    }

    await broadcastGameState();

    // Stop pooling market updates when phase ends
    stopPoolingMarketUpdates();

    // Stop round timer
    stopRoundTimer();

    // Additional logging for phase completion
    if (currentPhase === 'simulation') {
      console.log('🎉 Game auto-completed! All phases finished.');
    }

  } catch (error) {
    console.error('Error auto-ending phase:', error);
    stopRoundTimer();
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
  isActive: gameSession.isActive,
  remainingTime: remainingTime,
  ...sanitizeSettings(gameSession.settings)
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

  // Simple per-socket rate limiting for admin login
  const loginState = { count: 0, firstTryAt: Date.now() };
  const MAX_TRIES = 5;
  const WINDOW_MS = 60_000; // 1 minute

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
  isActive: gameSession.isActive,
  remainingTime: remainingTime,
  ...sanitizeSettings(gameSession.settings)
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
      // Rate limit
      const now = Date.now();
      if (now - loginState.firstTryAt > WINDOW_MS) {
        loginState.firstTryAt = now;
        loginState.count = 0;
      }
      loginState.count += 1;
      if (loginState.count > MAX_TRIES) {
        socket.emit('adminLoginError', 'Too many attempts, please wait a minute.');
        return;
      }

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

    console.log('Admin login attempt', {
      envConfigured: !!expectedPassword,
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
  socket.on('updateTeamDecision', async (decision, ack) => {
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

        if (typeof ack === 'function') ack({ ok: true });
      } else {
        if (typeof ack === 'function') ack({ ok: false, error: 'Team not found or inactive' });
      }
    } catch (error) {
      console.error('Error updating team decision:', error);
      if (typeof ack === 'function') ack({ ok: false, error: 'Failed to update team decision' });
      else socket.emit('error', 'Failed to update team decision');
    }
  });

  // Server-side Practice Mode: simulate rounds vs. AI without touching DB state
  socket.on('startPracticeMode', async (config = {}) => {
    try {
      // Ensure a registered team exists for this socket
      const humanTeam = await Team.findOne({ where: { socketId: socket.id, isActive: true } });
      if (!humanTeam) {
        socket.emit('practiceError', 'Bitte zuerst als Team registrieren.');
        return;
      }

      // Randomized settings for the practice session
      const rnd = (min, max) => Math.random() * (max - min) + min;
      const irnd = (min, max) => Math.floor(rnd(min, max + 1));

      const rounds = Math.max(1, Math.min(5, Number(config.rounds) || 3));
      const aiCount = Math.max(2, Math.min(6, Number(config.aiCount) || irnd(2, 5)));

      const settings = {
        baseDemand: irnd(80, 240),
        demandVolatility: rnd(0.05, 0.2),
        priceElasticity: -(rnd(0.9, 2.7)),
        marketConcentration: rnd(0.6, 0.9),
        totalAircraftSeats: irnd(600, 1400),
        fixSeatPrice: irnd(50, 80),
        hotelBedCost: irnd(30, 70),
        costVolatility: rnd(0.03, 0.1),
        poolingMarket: { currentPrice: irnd(100, 220) }
      };

      // Build ephemeral team list: human + randomized AIs
      const totalTeams = aiCount + 1;
      const perTeamHotel = Math.floor(((settings.totalAircraftSeats || 1000) * 0.6) / totalTeams);

      const humanDecisions = {
        price: typeof config.overridePrice === 'number' ? config.overridePrice : (humanTeam.decisions?.price ?? 199),
        fixSeatsPurchased: Number(humanTeam.decisions?.fixSeatsPurchased || 0),
        fixSeatsAllocated: Number(humanTeam.decisions?.fixSeatsAllocated || 0),
        poolingAllocation: Number(humanTeam.decisions?.poolingAllocation || 0),
        hotelCapacity: Number(humanTeam.decisions?.hotelCapacity || perTeamHotel)
      };

      const teams = [
        {
          id: humanTeam.id,
          name: humanTeam.name,
          decisions: humanDecisions,
          totalProfit: 0
        }
      ];

      for (let i = 0; i < aiCount; i++) {
        // AI teams make more strategic decisions based on market conditions
        const aiStrategy = Math.random();
        let aiPooling = 0;
        let aiFixSeats = 0;
        
        if (aiStrategy < 0.3) {
          // Conservative strategy: focus on fix seats
          aiFixSeats = irnd(50, 120);
          aiPooling = irnd(10, 30);
        } else if (aiStrategy < 0.7) {
          // Balanced strategy: mix of fix and pooling
          aiFixSeats = irnd(20, 80);
          aiPooling = irnd(30, 60);
        } else {
          // Aggressive strategy: heavy pooling usage
          aiFixSeats = irnd(10, 40);
          aiPooling = irnd(50, 80);
        }
        
        teams.push({
          id: `AI_${i + 1}`,
          name: `AI Team ${i + 1}`,
          decisions: {
            price: irnd(180, 280), // More realistic price range
            fixSeatsPurchased: aiFixSeats,
            fixSeatsAllocated: aiFixSeats, // AI teams allocate all purchased seats
            poolingAllocation: aiPooling,
            hotelCapacity: perTeamHotel
          },
          totalProfit: 0
        });
      }

      // Auto-run rounds and collect history
      const perRound = [];
      for (let r = 1; r <= rounds; r++) {
        const raw = calculateRoundResults(teams, settings);
        const rr = raw.map(res => ({
          ...res,
          teamName: teams.find(t => t.id === res.teamId)?.name || String(res.teamId)
        }));
        // accumulate profit
        rr.forEach(res => {
          const t = teams.find(t => t.id === res.teamId);
          if (t) t.totalProfit = Number(t.totalProfit || 0) + Number(res.profit || 0);
        });
        perRound.push({ round: r, teamResults: rr });
      }

      const leaderboard = teams
        .map(t => ({ name: t.name, profit: Math.round(Number(t.totalProfit || 0)) }))
        .sort((a, b) => b.profit - a.profit);

      socket.emit('practiceResults', {
        config: { rounds, aiCount },
        settings,
        rounds: perRound,
        leaderboard
      });
    } catch (err) {
      console.error('Error running practice mode:', err);
      socket.emit('practiceError', 'Übungsmodus fehlgeschlagen.');
    }
  });



  // End round (admin only)
  socket.on('endRound', async () => {
    if (socket.id === adminSocket) {
      try {
        const session = await GameService.getCurrentGameSession();

        // Validate that a phase is actually running
        if (!session.isActive) {
          socket.emit('error', 'No active phase to end');
          return;
        }

        const currentPhase = session.settings?.currentPhase;

        // Handle different phase endings
        if (currentPhase === 'prePurchase') {
          // End of Pre-Purchase Phase: Allocate fix seats
          console.log('🎯 Allocating fix seats at end of pre-purchase phase...');
          const allocationResult = await GameService.allocateFixSeats();

          // Broadcast allocation results to all clients
          io.emit('fixSeatsAllocated', allocationResult);
          console.log('✅ Fix seats allocation completed');
        } else if (currentPhase === 'simulation') {
          // End of Simulation Phase: Final evaluation and achievements
          console.log('🏆 Simulation phase ended - evaluating final results and achievements...');

          // Broadcast final phase completion
          io.emit('finalPhaseCompleted', {
            message: 'Simulation phase completed! Achievements will be evaluated.',
            phaseNumber: 2
          });
        }

        // End the current phase
        await GameService.endPhase();

        // Calculate and save results if this is the simulation phase
        if (currentPhase === 'simulation') {
          const endRes = await GameService.endRound(calculateRoundResults);
          const updatedSession = await GameService.getCurrentGameSession();

          io.emit('roundEnded', {
            roundResults: endRes.results,
            phaseNumber: 2,
            isFinalPhase: true,
            currentRound: endRes.currentRound,
            isGameComplete: endRes.isGameComplete
          });

          console.log(`Simulation phase ended with ${endRes.results.reduce((sum, r) => sum + r.sold, 0)} total sales`);
          if (endRes.isGameComplete) {
            console.log(`🎉 Game completed! All rounds finished.`);
          } else {
            console.log(`Round ${endRes.currentRound - 1} completed.`);
          }
        } else {
          // For pre-purchase phase, just broadcast phase ended
          io.emit('phaseEnded', {
            phaseNumber: 1,
            isFinalPhase: false
          });
        }

        await broadcastGameState();

        // Stop pooling market updates when phase ends
        stopPoolingMarketUpdates();

        // Stop round timer when phase ends
        stopRoundTimer();

    // Additional logging for phase completion
    if (currentPhase === 'simulation') {
      console.log('🎉 Game round completed! Admin can start next round.');
    }      } catch (error) {
        console.error('Error ending phase:', error);
        socket.emit('error', `Failed to end phase: ${error.message}`);
      }
    } else {
      socket.emit('error', 'Unauthorized: Admin access required');
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

        // Start round timer
        startRoundTimer();
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

        // Start round timer
        startRoundTimer();
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

        // Stop round timer when phase ends
        stopRoundTimer();
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
    const totalPoolingCapacity = Math.round((settings.totalAircraftSeats || 1000) * poolingAllocation);
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

const PORT = process.env.PORT || 3001;

// Start the server with database initialization
initializeServer();
