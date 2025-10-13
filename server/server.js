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
  let updateInterval = 1000; // default: 1s per update
  let secondsPerDay = 1;
  try {
    const session = GameService.currentGameSession; // fast path if cached
    const intervalSec = session?.settings?.secondsPerDay ?? session?.settings?.poolingMarketUpdateInterval ?? 1;
    const parsed = Number(intervalSec);
    secondsPerDay = (Number.isFinite(parsed) && parsed > 0) ? parsed : 1;
    updateInterval = secondsPerDay * 1000;
  } catch {
    secondsPerDay = 1;
    updateInterval = 1000;
  }

  // Update pooling market every configured interval during simulation
  poolingMarketInterval = setInterval(async () => {
    try {
      const session = await GameService.getCurrentGameSession();
      if (session.settings?.currentPhase === 'simulation' && session.isActive) {
        const update = await GameService.updatePoolingMarket();
        await broadcastGameState();
        if (update?.phaseCompleted) {
          await autoEndCurrentPhase();
          return;
        }
      } else {
        // Stop updates if simulation is no longer active
        stopPoolingMarketUpdates();
      }
    } catch (error) {
      console.error('Error updating pooling market:', error);
    }
  }, updateInterval);

  const sessionForLog = GameService.currentGameSession;
  const dayStepForLog = Number(sessionForLog?.settings?.simulatedWeeksPerUpdate ?? 1);
  console.log(`🏊 Pooling market updates started (every ${secondsPerDay}s; days per update = ${dayStepForLog})`);
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
    roundTime = settings.roundTime || 180; // Use roundTime for pre-purchase phase
  } else if (currentPhase === 'simulation') {
    // Simulation phase has no timer - controlled by Pooling Market Update Interval and Simulated Days per Update
    roundTime = null;
  } else {
    roundTime = 180; // Fallback
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
                fixSeatsRequested: undefined,
                fixSeatBidPrice: undefined,
                fixSeatClearingPrice: undefined,
                // Before allocation, also hide any allocated amounts
                fixSeatsAllocated: (gameSession.settings?.fixSeatsAllocated ? team.decisions?.fixSeatsAllocated : undefined)
              },
              totalProfit: team.totalProfit,
              totalRevenue: team.totalRevenue
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
              totalProfit: team.totalProfit,
              totalRevenue: team.totalRevenue
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
                fixSeatsRequested: undefined,
                fixSeatBidPrice: undefined,
                fixSeatClearingPrice: undefined,
                fixSeatsAllocated: (gameSession.settings?.fixSeatsAllocated ? team.decisions?.fixSeatsAllocated : undefined)
              },
              totalProfit: team.totalProfit,
              totalRevenue: team.totalRevenue
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
              totalProfit: team.totalProfit,
              totalRevenue: team.totalRevenue
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
        totalProfit: team.totalProfit,
        totalRevenue: team.totalRevenue
      });

  // Share resume token privately
  socket.emit('resumeToken', team.resumeToken);

      // Broadcast updated game state to all clients
      await broadcastGameState();

      console.log(`Team registered: ${teamName}`);
    } catch (error) {
      socket.emit('registrationError', error.message);
    }
  });

  // Resume team by token
  socket.on('resumeTeam', async (token, ack) => {
    try {
      const team = await GameService.resumeTeam(socket.id, token);
      if (!team) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Invalid or expired session token.' });
        return;
      }
      // On successful resume, send current personalized game state
      await broadcastGameState();
      if (typeof ack === 'function') ack({ ok: true, team: { id: team.id, name: team.name, decisions: team.decisions, totalProfit: team.totalProfit, totalRevenue: team.totalRevenue } });
    } catch (e) {
      console.error('Error resuming team:', e);
      if (typeof ack === 'function') ack({ ok: false, error: 'Failed to resume team' });
    }
  });

  // Explicit logout
  socket.on('logoutTeam', async (ack) => {
    try {
      const team = await GameService.logoutTeam(socket.id);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false });
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

        // If simulation is running, apply timing changes immediately
        try {
          const session = await GameService.getCurrentGameSession();
          if (session.settings?.currentPhase === 'simulation' && session.isActive) {
            startPoolingMarketUpdates();
          }
        } catch (e) {
          console.warn('Failed to apply live pooling interval update:', e?.message || e);
        }
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
        socket.emit('practiceError', 'Please register your team before starting practice mode.');
        return;
      }

      // Helpers for randomness
      const rnd = (min, max) => Math.random() * (max - min) + min;
      const irnd = (min, max) => Math.floor(rnd(min, max + 1));

      // Practice parameters
      const aiCount = Math.max(2, Math.min(6, Number(config.aiCount) || irnd(2, 5)));
      const prePurchaseDurationSec = 60; // always 1 minute
      const daysTotal = 365; // represent a year
      const daysPerUpdate = 1; // 1 day per update (semantic)

      // Randomized market settings (covering all important admin controls)
      const settings = {
        baseDemand: irnd(80, 240),
        demandVolatility: rnd(0.05, 0.2),
        priceElasticity: -(rnd(0.9, 2.7)),
        marketPriceElasticity: -(rnd(0.5, 1.8)),
        referencePrice: irnd(170, 230),
        crossElasticity: rnd(0.0, 1.0),
        marketConcentration: rnd(0.5, 0.9),
        totalAircraftSeats: irnd(600, 1400),
        fixSeatPrice: irnd(50, 80),
        poolingCost: irnd(70, 120),
        costVolatility: rnd(0.03, 0.1),
        poolingMarketUpdateInterval: 1,
        simulatedWeeksPerUpdate: 1,
        poolingMarket: { currentPrice: irnd(100, 220) }
      };

      // Build ephemeral team list: human + randomized AIs
      const totalTeams = aiCount + 1;

      const defaultRequest = Math.max(10, Math.floor(((settings.totalAircraftSeats || 1000) * 0.4) / totalTeams));
      const requestedSeats = Number.isFinite(Number(config.overrideFixSeats)) && Number(config.overrideFixSeats) > 0
        ? Math.floor(Number(config.overrideFixSeats))
        : Number(humanTeam.decisions?.fixSeatsRequested ?? humanTeam.decisions?.fixSeatsPurchased ?? defaultRequest);
      const bidPrice = Number.isFinite(Number(config.overrideBid)) && Number(config.overrideBid) > 0
        ? Math.round(Number(config.overrideBid))
        : Number(humanTeam.decisions?.fixSeatBidPrice || settings.fixSeatPrice || 60);

      const humanDecisions = {
        price: typeof config.overridePrice === 'number' ? config.overridePrice : (humanTeam.decisions?.price ?? 500),
        fixSeatsRequested: Math.max(1, requestedSeats),
        fixSeatsPurchased: Math.max(1, requestedSeats),
        poolingAllocation: Number.isFinite(Number(humanTeam.decisions?.poolingAllocation))
          ? Number(humanTeam.decisions?.poolingAllocation)
          : irnd(20, 40),
        fixSeatBidPrice: bidPrice,
        fixSeatClearingPrice: bidPrice
      };

      const teams = [
        {
          id: humanTeam.id,
          name: humanTeam.name,
          decisions: humanDecisions,
          totalProfit: 0,
          totalRevenue: 0
        }
      ];

      for (let i = 0; i < aiCount; i++) {
        // AI strategies
        const aiStrategy = Math.random();
        let aiPooling = 0;
        let aiFixSeats = 0;

        if (aiStrategy < 0.3) {
          aiFixSeats = irnd(50, 120);
          aiPooling = irnd(10, 30);
        } else if (aiStrategy < 0.7) {
          aiFixSeats = irnd(20, 80);
          aiPooling = irnd(30, 60);
        } else {
          aiFixSeats = irnd(10, 40);
          aiPooling = irnd(50, 80);
        }

        teams.push({
          id: `AI_${i + 1}`,
          name: `AI Team ${i + 1}`,
          decisions: {
            price: irnd(180, 280),
            fixSeatsRequested: aiFixSeats,
            fixSeatsPurchased: aiFixSeats,
            poolingAllocation: aiPooling,
            fixSeatBidPrice: irnd(50, 120),
            fixSeatClearingPrice: null
          },
          totalProfit: 0,
          totalRevenue: 0
        });
      }

      // Phase 1: Pre-Purchase allocation (proportional if oversubscribed)
      const totalCapacity = settings.totalAircraftSeats || 1000;
      const poolingReserveRatio = 0.3; // 30% reserved for pooling, like real game
      const maxFixCapacity = Math.floor(totalCapacity * (1 - poolingReserveRatio));

      const defaultBid = Number(settings.fixSeatPrice || 60) || 60;
      const requests = teams.map(team => {
        const requested = Math.max(0, Math.floor(Number(team.decisions?.fixSeatsPurchased || 0)));
        const bidPrice = Number.isFinite(Number(team.decisions?.fixSeatBidPrice)) && Number(team.decisions.fixSeatBidPrice) > 0
          ? Math.round(Number(team.decisions.fixSeatBidPrice))
          : defaultBid;
        return { team, requested, bidPrice };
      });

      const groupedRequests = [...requests].sort((a, b) => {
        if (b.bidPrice !== a.bidPrice) return b.bidPrice - a.bidPrice;
        return a.team.id.localeCompare(b.team.id);
      }).reduce((map, req) => {
        if (!map.has(req.bidPrice)) map.set(req.bidPrice, []);
        map.get(req.bidPrice).push(req);
        return map;
      }, new Map());

      let remaining = maxFixCapacity;
      const allocationMap = new Map();

      for (const [price, group] of groupedRequests.entries()) {
        if (remaining <= 0) {
          group.forEach(req => allocationMap.set(req.team.id, { allocated: 0, price }));
          continue;
        }
        const totalGroupRequested = group.reduce((sum, req) => sum + req.requested, 0);
        if (totalGroupRequested <= remaining) {
          for (const req of group) {
            allocationMap.set(req.team.id, { allocated: req.requested, price });
            remaining -= req.requested;
          }
          continue;
        }

        const ratio = remaining / totalGroupRequested;
        const provisional = group.map(req => {
          const exact = req.requested * ratio;
          const base = Math.floor(exact);
          const remainder = exact - base;
          return { req, base, remainder };
        });
        let seatsLeft = remaining - provisional.reduce((sum, item) => sum + item.base, 0);
        provisional.sort((a, b) => {
          if (b.remainder !== a.remainder) return b.remainder - a.remainder;
          return a.req.team.id.localeCompare(b.req.team.id);
        });
        for (const item of provisional) {
          let extra = 0;
          if (seatsLeft > 0) {
            extra = 1;
            seatsLeft -= 1;
          }
          allocationMap.set(item.req.team.id, { allocated: item.base + extra, price });
        }
        remaining = 0;
      }

      const allocations = teams.map(team => {
        const allocInfo = allocationMap.get(team.id) || { allocated: 0, price: defaultBid };
        const requested = Math.max(0, Math.floor(Number(team.decisions?.fixSeatsPurchased || 0)));
        const allocated = Math.max(0, Math.min(requested, allocInfo.allocated));
        const price = allocInfo.price;
        team.decisions.fixSeatsRequested = requested;
        team.decisions.fixSeatsPurchased = allocated;
        team.decisions.fixSeatsAllocated = allocated;
        team.decisions.fixSeatClearingPrice = allocated > 0 ? price : null;
        team.decisions.fixSeatBidPrice = price;
        return { teamId: team.id, teamName: team.name, requested, allocated, bidPrice: price, clearingPrice: team.decisions.fixSeatClearingPrice };
      });

      const totalAllocated = allocations.reduce((sum, a) => sum + a.allocated, 0);

      // Phase 2: Market simulation over the configured period
      const poolingReserve = Math.max(0, (settings.totalAircraftSeats || 1000) - totalAllocated);
      let poolAvailable = poolingReserve;
      const basePoolCost = settings.poolingCost || 90;
      let poolPrice = typeof settings.poolingMarket?.currentPrice === 'number'
        ? settings.poolingMarket.currentPrice
        : basePoolCost;
      const poolPriceHistory = [];

      const teamState = teams.map(team => {
        const allocated = Math.max(0, team.decisions?.fixSeatsAllocated || 0);
        const clearing = Number.isFinite(Number(team.decisions?.fixSeatClearingPrice)) && Number(team.decisions.fixSeatClearingPrice) > 0
          ? Number(team.decisions.fixSeatClearingPrice)
          : (settings.fixSeatPrice || 60);
        return {
          team,
          fixRemaining: allocated,
          sold: 0,
          poolUsed: 0,
          demand: 0,
          revenue: 0,
          cost: allocated * clearing,
          initialFix: allocated,
          initialPool: 0,
          insolvent: false
        };
      });

      const ticks = Math.max(1, Math.ceil(daysTotal / Math.max(1, daysPerUpdate)));
      for (let tick = 0; tick < ticks; tick++) {
        const baseDemand = Math.max(10, settings.baseDemand || 100);
        const volatility = Math.abs(settings.demandVolatility || 0.1);
        const demandNoise = (Math.random() * 2 - 1) * volatility;
        const totalDemand = Math.max(0, Math.round(baseDemand * (1 + demandNoise)));

        const minPrice = teams.reduce((min, team) => Math.min(min, team.decisions.price || 500), Infinity);
        const refPrice = typeof settings.referencePrice === 'number' ? settings.referencePrice : 199;
        const elasticity = Math.abs(settings.priceElasticity || 1.2);
        const marketElasticity = Math.abs(settings.marketPriceElasticity || elasticity * 0.6);

        const weights = teams.map(team => {
          const price = team.decisions.price || 500;
          const relToMin = price / Math.max(1, minPrice);
          const relToRef = price / Math.max(1, refPrice);
          const competitiveness = Math.pow(relToMin, -elasticity);
          const demandModifier = Math.pow(relToRef, -marketElasticity);
          return Math.max(competitiveness * demandModifier, 0.0001);
        });
        const weightSum = weights.reduce((sum, w) => sum + w, 0) || teams.length;
        const desiredDemand = teams.map((_, idx) => (totalDemand * weights[idx]) / weightSum);
        const demandInt = desiredDemand.map(Math.floor);
        let remainder = totalDemand - demandInt.reduce((sum, val) => sum + val, 0);
        const remainders = desiredDemand.map((value, idx) => ({ idx, frac: value - Math.floor(value) }))
          .sort((a, b) => b.frac - a.frac || a.idx - b.idx);
        for (const entry of remainders) {
          if (remainder <= 0) break;
          demandInt[entry.idx] += 1;
          remainder -= 1;
        }

        const ranking = teams.map((team, idx) => ({ idx, price: team.decisions.price || 500, name: team.name }))
          .sort((a, b) => {
            if (a.price !== b.price) return a.price - b.price;
            return a.name.localeCompare(b.name);
          });

        let unsatisfied = 0;
        for (const { idx } of ranking) {
          const state = teamState[idx];
          const demand = demandInt[idx];
          const sellFix = Math.min(demand, state.fixRemaining);
          let remaining = demand - sellFix;
          const sellPool = Math.min(remaining, Math.max(0, poolAvailable));
          poolAvailable -= sellPool;
          remaining -= sellPool;
          unsatisfied += Math.max(0, remaining);

          state.fixRemaining = Math.max(0, state.fixRemaining - sellFix);
          state.sold += sellFix + sellPool;
          state.poolUsed += sellPool;
          state.demand += demand;
          state.initialPool = Math.max(state.initialPool, state.poolUsed);

          const price = teams[idx].decisions.price || 500;
          state.revenue += (sellFix + sellPool) * price;
          state.cost += sellPool * poolPrice;
        }

        const utilization = poolingReserve > 0 ? (poolingReserve - Math.max(0, poolAvailable)) / poolingReserve : 0;
        if (unsatisfied > 0 || utilization > 0.85) {
          poolPrice += Math.min(25, (unsatisfied > 0 ? 10 : 0) + (utilization - 0.85) * 80);
        } else if (utilization < 0.4 && unsatisfied === 0) {
          poolPrice -= Math.min(20, (0.4 - utilization) * 70);
        }
        poolPrice = Math.round(Math.max(basePoolCost * 0.6, Math.min(basePoolCost * 2.2, poolPrice + (Math.random() - 0.5) * 4)));
        poolPriceHistory.push({ price: poolPrice, timestamp: new Date().toISOString() });

        const budget = Number(settings.perTeamBudget || 0);
        teamState.forEach(state => {
          const profit = state.revenue - state.cost;
          if (profit < 0 && Math.abs(profit) > budget) {
            state.insolvent = true;
          }
        });

        if (poolAvailable <= 0) break;
      }

      const totalSold = teamState.reduce((sum, state) => sum + state.sold, 0) || 1;
      const practiceResults = teams.map((team, idx) => {
        const state = teamState[idx];
        const revenue = Math.round(state.revenue);
        const profit = Math.round(state.revenue - state.cost);
        team.totalProfit = profit;
        team.totalRevenue = revenue;
        return {
          teamId: team.id,
          teamName: team.name,
          sold: Math.round(state.sold),
          revenue,
          cost: Math.round(state.cost),
          profit,
          demand: Math.round(state.demand),
          capacity: Math.round(state.initialFix + state.initialPool),
          insolvent: !!state.insolvent,
          marketShare: state.sold / totalSold,
          avgPrice: team.decisions.price || 500
        };
      });

      const leaderboard = teams
        .map(team => ({
          name: team.name,
          revenue: Math.round(team.totalRevenue || 0),
          profit: Math.round(team.totalProfit || 0)
        }))
        .sort((a, b) => {
          if (b.profit !== a.profit) return b.profit - a.profit;
          return b.revenue - a.revenue;
        });

      settings.poolingMarket = {
        currentPrice: poolPrice,
        totalPoolingCapacity: poolingReserve,
        availablePoolingCapacity: Math.max(0, poolAvailable),
        priceHistory: poolPriceHistory,
        lastUpdate: new Date().toISOString()
      };

      socket.emit('practiceResults', {
        config: { aiCount, prePurchaseDurationSec, daysPerUpdate, daysTotal },
        settings,
        phases: {
          prePurchase: { allocations, maxFixCapacity, totalRequested: allocations.reduce((sum, a) => sum + a.requested, 0) },
          simulation: {
            summary: {
              finalPoolingPrice: poolPrice,
              remainingPoolingCapacity: Math.max(0, poolAvailable)
            }
          }
        },
        rounds: [{ round: 1, teamResults: practiceResults }],
        leaderboard
      });
    } catch (err) {
      console.error('Error running practice mode:', err);
      socket.emit('practiceError', 'Practice mode failed.');
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
      // Do not delete or deactivate the team on disconnect; keep them resumable
      // Just clear the socketId so the slot can be reused on resume
      const teams = await GameService.getActiveTeams();
      const t = teams.find(t => t.socketId === socket.id);
      if (t) {
        await t.update({ socketId: null });
      }

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
    const teamMonthlyRevenue = monthlyResults.map(m => {
      const teamResult = m.teamResults.find(r => r.teamId === team.id);
      return teamResult ? teamResult.revenue : 0;
    });

    const totalSimulationProfit = teamMonthlyProfits.reduce((sum, profit) => sum + profit, 0);
    const totalSimulationRevenue = teamMonthlyRevenue.reduce((sum, revenue) => sum + revenue, 0);
    const newTotalProfit = parseFloat(team.totalProfit || 0) + totalSimulationProfit;
    const newTotalRevenue = parseFloat(team.totalRevenue || 0) + totalSimulationRevenue;

    await team.update({ totalProfit: newTotalProfit, totalRevenue: newTotalRevenue });
  }

  return {
    monthlyResults,
    totalSimulationProfit: monthlyResults.reduce((sum, month) => sum + month.teamResults.reduce((teamSum, team) => teamSum + team.profit, 0), 0),
    totalSimulationRevenue: monthlyResults.reduce((sum, month) => sum + month.teamResults.reduce((teamSum, team) => teamSum + team.revenue, 0), 0)
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
    const fixSeats = (team.decisions?.fixSeatsAllocated ?? team.decisions?.fixSeatsPurchased ?? 0);
    const poolingAllocation = (team.decisions.poolingAllocation || 0) / 100;
    const totalPoolingCapacity = Math.round((settings.totalAircraftSeats || 1000) * poolingAllocation);
    const availableCapacity = fixSeats + totalPoolingCapacity;

    // Calculate actual sales
    const sold = Math.min(teamDemand, availableCapacity);
    const price = team.decisions.price || 500;

    // Revenue from passenger sales
    const passengerRevenue = sold * price;

    // Costs
    const clearingPrice = Number.isFinite(Number(team.decisions?.fixSeatClearingPrice)) && Number(team.decisions.fixSeatClearingPrice) > 0
      ? Number(team.decisions.fixSeatClearingPrice)
      : (settings.fixSeatPrice || 60);
    const fixSeatCost = fixSeats * clearingPrice;
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
