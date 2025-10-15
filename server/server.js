import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './database.js';
import { syncDatabase, Team } from './models.js';
import GameService from './gameService.js';
import { calculateRoundResults, calculateMarketShares } from './calc.js';

const FIX_SHARE_PER_TEAM = 0.08;
const TEAM_INACTIVITY_CHECK_INTERVAL_MS = 60_000;

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

    // Ensure active teams without timestamps get current activity marker
    try {
      await Team.update(
        { lastActiveAt: new Date() },
        { where: { isActive: true, lastActiveAt: null } }
      );
    } catch (e) {
      console.warn('Warning while normalizing lastActiveAt values:', e?.message || e);
    }

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
      const timeoutMs = GameService.getInactivityTimeoutMs();
      if (timeoutMs > 0) {
        if (teamInactivityInterval) clearInterval(teamInactivityInterval);
        teamInactivityInterval = setInterval(
          enforceTeamInactivityTimeout,
          TEAM_INACTIVITY_CHECK_INTERVAL_MS
        );
        const timeoutMinutes = Math.max(1, Math.round(timeoutMs / 60000));
        console.log(`⏱️ Team inactivity timeout enabled (${timeoutMinutes} min; checks every ${Math.round(TEAM_INACTIVITY_CHECK_INTERVAL_MS / 1000)}s)`);
      }
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5175'}`);
    });
    // Run initial cleanup once on boot
    await enforceTeamInactivityTimeout();

  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Global variables for current session state (cached for performance)
let adminSocket = null;
const sessionRuntimes = new Map(); // sessionId -> { remainingTime, roundTimerInterval, poolingMarketInterval }
let teamInactivityInterval = null; // Background cleanup for inactive teams

const getSessionRoom = (sessionId) => `session:${sessionId}`;

function getSessionRuntime(sessionId) {
  if (!sessionId) return null;
  let runtime = sessionRuntimes.get(sessionId);
  if (!runtime) {
    runtime = {
      remainingTime: 0,
      roundTimerInterval: null,
      poolingMarketInterval: null
    };
    sessionRuntimes.set(sessionId, runtime);
  }
  return runtime;
}

function clearSessionRuntime(sessionId) {
  const runtime = sessionRuntimes.get(sessionId);
  if (!runtime) return;
  if (runtime.roundTimerInterval) {
    clearInterval(runtime.roundTimerInterval);
  }
  if (runtime.poolingMarketInterval) {
    clearInterval(runtime.poolingMarketInterval);
  }
  sessionRuntimes.delete(sessionId);
}

function attachSocketToSession(socket, sessionId, teamId = null) {
  if (!sessionId) return;
  if (socket.data?.sessionId && socket.data.sessionId !== sessionId) {
    socket.leave(getSessionRoom(socket.data.sessionId));
  }
  socket.data.sessionId = sessionId;
  if (teamId) {
    socket.data.teamId = teamId;
  }
  socket.join(getSessionRoom(sessionId));
}

async function broadcastSessionList() {
  try {
    const sessions = await GameService.listSessions();
    io.emit('sessionList', sessions);
  } catch (error) {
    console.error('Error broadcasting session list:', error);
  }
}

async function emitSessionList(socket) {
  try {
    const sessions = await GameService.listSessions();
    socket.emit('sessionList', sessions);
  } catch (error) {
    console.error(`Error sending session list to socket ${socket.id}:`, error);
  }
}

const randBetween = (min, max) => Math.random() * (max - min) + min;
const randIntBetween = (min, max) => Math.floor(randBetween(min, max + 1));

function buildRandomMultiplayerSettings() {
  const totalSeats = randIntBetween(600, 1400);
  return {
    baseDemand: randIntBetween(80, 240),
    demandVolatility: Number(randBetween(0.05, 0.2).toFixed(3)),
    priceElasticity: -Number(randBetween(0.9, 2.7).toFixed(2)),
    marketPriceElasticity: -Number(randBetween(0.5, 1.8).toFixed(2)),
    referencePrice: randIntBetween(170, 230),
    crossElasticity: Number(randBetween(0.0, 1.0).toFixed(2)),
    marketConcentration: Number(randBetween(0.5, 0.9).toFixed(2)),
    totalAircraftSeats: totalSeats,
    totalCapacity: totalSeats,
    fixSeatPrice: randIntBetween(50, 80),
    poolingCost: randIntBetween(70, 120),
    costVolatility: Number(randBetween(0.03, 0.1).toFixed(3)),
    poolingMarketUpdateInterval: 1,
    simulatedWeeksPerUpdate: 7,
    secondsPerDay: 1,
    autoAdvance: true,
    simulationTicksTotal: 365,
    roundTime: 180,
    perTeamBudget: 10000
  };
}

// Start periodic pooling market updates for a given session
function startPoolingMarketUpdates(sessionId) {
  const runtime = getSessionRuntime(sessionId);
  if (!runtime) return;

  if (runtime.poolingMarketInterval) {
    clearInterval(runtime.poolingMarketInterval);
  }

  let updateInterval = 1000;
  let secondsPerDay = 1;
  try {
    const session = GameService.currentGameSession && GameService.currentGameSession.id === sessionId
      ? GameService.currentGameSession
      : GameService.sessionCache?.get(sessionId);
    const intervalSec = session?.settings?.secondsPerDay ?? session?.settings?.poolingMarketUpdateInterval ?? 1;
    const parsed = Number(intervalSec);
    secondsPerDay = (Number.isFinite(parsed) && parsed > 0) ? parsed : 1;
    updateInterval = secondsPerDay * 1000;
  } catch {
    secondsPerDay = 1;
    updateInterval = 1000;
  }

  runtime.poolingMarketInterval = setInterval(async () => {
    try {
      const session = await GameService.getCurrentGameSession(sessionId);
      if (session.settings?.currentPhase === 'simulation' && session.isActive) {
        const update = await GameService.updatePoolingMarket(sessionId);
        await broadcastGameState(sessionId);
        if (update?.phaseCompleted) {
          await autoEndCurrentPhase(sessionId);
        }
      } else {
        stopPoolingMarketUpdates(sessionId);
      }
    } catch (error) {
      console.error(`Error updating pooling market for session ${sessionId}:`, error);
    }
  }, updateInterval);

  console.log(`🏊 Pooling market updates started for session ${sessionId} (every ${secondsPerDay}s)`);
}

// Stop pooling market updates
function stopPoolingMarketUpdates(sessionId) {
  const runtime = getSessionRuntime(sessionId);
  if (!runtime) return;
  if (runtime.poolingMarketInterval) {
    clearInterval(runtime.poolingMarketInterval);
    runtime.poolingMarketInterval = null;
    console.log(`🏊 Pooling market updates stopped for session ${sessionId}`);
  }
}

// Start round timer countdown for a session
async function startRoundTimer(sessionId, overrideSeconds = null) {
  const runtime = getSessionRuntime(sessionId);
  if (!runtime) return;

  if (runtime.roundTimerInterval) {
    clearInterval(runtime.roundTimerInterval);
  }

  const session = await GameService.getCurrentGameSession(sessionId);
  if (!session) {
    console.error(`No active session found for timer (${sessionId})`);
    return;
  }

  const settings = session.settings || {};
  const currentPhase = settings.currentPhase;

  let roundTime = overrideSeconds;
  if (roundTime === null || roundTime === undefined) {
    if (currentPhase === 'prePurchase') {
      roundTime = settings.roundTime || 180;
    } else if (currentPhase === 'simulation') {
      roundTime = null;
    } else {
      roundTime = 180;
    }
  }

  runtime.remainingTime = Number.isFinite(roundTime) ? Math.max(0, Math.round(roundTime)) : 0;

  if (roundTime === null || runtime.remainingTime <= 0) {
    console.log(`⏰ ${currentPhase} phase has no active timer for session ${sessionId}`);
    return;
  }

  runtime.roundTimerInterval = setInterval(async () => {
    try {
      runtime.remainingTime = Math.max(0, runtime.remainingTime - 1);
      await broadcastGameState(sessionId);
      if (runtime.remainingTime <= 0) {
        console.log(`⏰ ${currentPhase} phase time is up for session ${sessionId}! Auto-ending phase...`);
        await autoEndCurrentPhase(sessionId);
      }
    } catch (error) {
      console.error(`Error updating round timer for session ${sessionId}:`, error);
    }
  }, 1000);

  console.log(`⏰ ${currentPhase} phase timer started for session ${sessionId} (${runtime.remainingTime} seconds)`);
}

// Stop round timer for a session
function stopRoundTimer(sessionId) {
  const runtime = getSessionRuntime(sessionId);
  if (!runtime) return;
  if (runtime.roundTimerInterval) {
    clearInterval(runtime.roundTimerInterval);
    runtime.roundTimerInterval = null;
    console.log(`⏰ Round timer stopped for session ${sessionId}`);
  }
}

// Auto-end current phase when timer runs out for a session
async function autoEndCurrentPhase(sessionId) {
  try {
    const session = await GameService.getCurrentGameSession(sessionId);
    if (!session?.isActive) {
      console.log(`No active phase to auto-end for session ${sessionId}`);
      stopRoundTimer(sessionId);
      return;
    }

    const currentPhase = session.settings?.currentPhase;
    console.log(`🔄 Auto-ending ${currentPhase} phase for session ${sessionId}...`);

    if (currentPhase === 'prePurchase') {
      console.log('🎯 Auto-allocating fix seats at end of pre-purchase phase...');
      const allocationResult = await GameService.allocateFixSeats(sessionId);
      io.to(getSessionRoom(sessionId)).emit('fixSeatsAllocated', allocationResult);
      console.log('✅ Fix seats auto-allocation completed');
    } else if (currentPhase === 'simulation') {
      console.log('🏆 Auto-ending simulation phase - evaluating final results and achievements...');
      io.to(getSessionRoom(sessionId)).emit('finalPhaseCompleted', {
        message: 'Simulation phase completed! Achievements will be evaluated.',
        phaseNumber: 2
      });
    }

    const autoAdvance = currentPhase === 'prePurchase' && !!session.settings?.autoAdvance;

    await GameService.endPhase(sessionId);

    if (currentPhase === 'simulation') {
      const endRes = await GameService.endRound(calculateRoundResults, sessionId);
      io.to(getSessionRoom(sessionId)).emit('roundEnded', {
        roundResults: endRes.results,
        phaseNumber: 2,
        isFinalPhase: true,
        currentRound: endRes.currentRound,
        isGameComplete: endRes.isGameComplete
      });
      console.log(`Simulation phase auto-ended with ${endRes.results.reduce((sum, r) => sum + r.sold, 0)} total sales (session ${sessionId})`);
    } else {
      io.to(getSessionRoom(sessionId)).emit('phaseEnded', {
        phaseNumber: 1,
        isFinalPhase: false
      });

      if (autoAdvance) {
        const nextSession = await GameService.startSimulationPhase(sessionId);
        startPoolingMarketUpdates(sessionId);
        const runtime = getSessionRuntime(sessionId);
        if (runtime) runtime.remainingTime = nextSession.settings?.countdownSeconds ?? 0;
        await broadcastGameState(sessionId);
        stopRoundTimer(sessionId);
        console.log(`🚀 Simulation phase started automatically for session ${sessionId}`);
        return;
      }
    }

    await broadcastGameState(sessionId);
    stopPoolingMarketUpdates(sessionId);
    stopRoundTimer(sessionId);

    if (currentPhase === 'simulation') {
      console.log(`🎉 Game auto-completed for session ${sessionId}! All phases finished.`);
    }
  } catch (error) {
    console.error(`Error auto-ending phase for session ${sessionId}:`, error);
    stopRoundTimer(sessionId);
  }
}

// Broadcast game state helper function
async function broadcastGameState(sessionId = null) {
  try {
    if (!sessionId) {
      const knownSessionIds = sessionRuntimes.size
        ? [...sessionRuntimes.keys()]
        : (await GameService.listSessions()).map((session) => session.id);
      await Promise.all(knownSessionIds.map(id => broadcastGameState(id)));
      return;
    }

    const session = await GameService.getCurrentGameSession(sessionId);
    const activeTeams = await GameService.getActiveTeams(session.id);
    const runtime = getSessionRuntime(sessionId) || { remainingTime: 0 };

    const connectedSockets = await io.fetchSockets();

    for (const socket of connectedSockets) {
      if (socket.data?.sessionId !== sessionId) continue;
      const gameState = createGameStatePayload(session, activeTeams, runtime, socket.id);
      socket.emit('gameStateUpdate', gameState);
    }
  } catch (error) {
    console.error(`Error broadcasting game state for session ${sessionId}:`, error);
  }
}

async function emitGameStateToSocket(sessionId, socket, eventName = 'gameState') {
  try {
    const session = await GameService.getCurrentGameSession(sessionId);
    const teams = await GameService.getActiveTeams(session.id);
    const runtime = getSessionRuntime(sessionId) || { remainingTime: 0 };
    const payload = createGameStatePayload(session, teams, runtime, socket.id);
    socket.emit(eventName, payload);
  } catch (error) {
    console.error(`Error emitting game state to socket ${socket.id} for session ${sessionId}:`, error);
  }
}

async function enforceTeamInactivityTimeout() {
  try {
    const { deactivated } = await GameService.deactivateInactiveTeams();
    if (!deactivated?.length) return;

    const timeoutMs = GameService.getInactivityTimeoutMs();
    const timeoutMinutes = Math.max(1, Math.round(timeoutMs / 60000));
    const message = `You were logged out after ${timeoutMinutes} minutes of inactivity. Please register again to continue playing.`;

    for (const team of deactivated) {
      if (team.socketId) {
        io.to(team.socketId).emit('teamAutoLogout', {
          reason: 'inactiveTimeout',
          message,
          teamId: team.id,
          teamName: team.name,
          timeoutMinutes
        });
      }
    }

    const names = deactivated.map(team => team.name).join(', ');
    console.log(`👋 Logged out inactive teams (${deactivated.length}): ${names || 'n/a'}`);

    await broadcastGameState();
  } catch (error) {
    console.error('Error enforcing team inactivity timeout:', error);
  }
}

// Socket.io connection handling
io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // Simple per-socket rate limiting for admin login
  const loginState = { count: 0, firstTryAt: Date.now() };
  const MAX_TRIES = 5;
  const WINDOW_MS = 60_000; // 1 minute

  socket.data = socket.data || {};
  socket.data.sessionId = null;
  socket.data.teamId = null;
  socket.data.isAdmin = false;

  await emitSessionList(socket);

  socket.emit('gameState', {
    teams: [],
    currentRound: 0,
    isActive: false,
    remainingTime: 0,
    sessionId: null
  });

  // Team registration
  socket.on('registerTeam', async (payload) => {
    const { teamName, sessionId } = typeof payload === 'string'
      ? { teamName: payload, sessionId: socket.data?.sessionId }
      : (payload || {});

    if (!sessionId) {
      socket.emit('registrationError', 'Please select a session before joining.');
      return;
    }

    try {
      const team = await GameService.registerTeam(socket.id, teamName, sessionId);
      attachSocketToSession(socket, sessionId, team.id);

      socket.emit('registrationSuccess', {
        id: team.id,
        name: team.name,
        decisions: team.decisions,
        totalProfit: team.totalProfit,
        totalRevenue: team.totalRevenue,
        sessionId
      });

      socket.emit('resumeToken', team.resumeToken);

      await emitGameStateToSocket(sessionId, socket, 'gameState');
      await broadcastGameState(sessionId);
      await broadcastSessionList();

      console.log(`Team registered: ${teamName} (session ${sessionId})`);
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
      const sessionId = team.gameSessionId;
      attachSocketToSession(socket, sessionId, team.id);
      await emitGameStateToSocket(sessionId, socket, 'gameState');
      await broadcastGameState(sessionId);
      await broadcastSessionList();
      if (typeof ack === 'function') {
        ack({
          ok: true,
          team: {
            id: team.id,
            name: team.name,
            decisions: team.decisions,
            totalProfit: team.totalProfit,
            totalRevenue: team.totalRevenue,
            sessionId
          }
        });
      }
    } catch (e) {
      console.error('Error resuming team:', e);
      if (typeof ack === 'function') ack({ ok: false, error: 'Failed to resume team' });
    }
  });

  // Explicit logout
  socket.on('logoutTeam', async (ack) => {
    try {
      const team = await GameService.logoutTeam(socket.id);
      if (team?.gameSessionId) {
        const sessionId = team.gameSessionId;
        socket.leave(getSessionRoom(sessionId));
        socket.data.sessionId = null;
        socket.data.teamId = null;
        await broadcastGameState(sessionId);
        await broadcastSessionList();
      }
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false });
    }
  });

  socket.on('session:list', async (ack) => {
    try {
      const sessions = await GameService.listSessions();
      if (typeof ack === 'function') {
        ack({ ok: true, sessions });
      } else {
        socket.emit('sessionList', sessions);
      }
    } catch (error) {
      console.error('Error listing sessions:', error);
      if (typeof ack === 'function') ack({ ok: false, error: 'Failed to fetch sessions' });
    }
  });

  socket.on('session:select', async ({ sessionId } = {}, ack) => {
    if (!sessionId) {
      const message = 'No session selected.';
      if (typeof ack === 'function') ack({ ok: false, error: message });
      else socket.emit('sessionLaunchError', message);
      return;
    }
    try {
      const session = await GameService.getCurrentGameSession(sessionId);
      attachSocketToSession(socket, session.id, socket.data?.teamId || null);
      await emitGameStateToSocket(session.id, socket, 'gameState');
      if (typeof ack === 'function') {
        ack({ ok: true, session: GameService.sanitizeSessionForClient(session) });
      }
    } catch (error) {
      console.error('Error selecting session:', error);
      const message = error?.message || 'Failed to select session';
      if (typeof ack === 'function') ack({ ok: false, error: message });
      else socket.emit('sessionLaunchError', message);
    }
  });

  socket.on('session:create', async ({ name } = {}, ack) => {
    try {
      const session = await GameService.createSession({ name });
      await broadcastSessionList();
      if (typeof ack === 'function') {
        ack({ ok: true, session });
      } else {
        socket.emit('sessionCreated', session);
      }
    } catch (error) {
      console.error('Error creating session:', error);
      const message = error?.message || 'Failed to create session';
      if (typeof ack === 'function') {
        ack({ ok: false, error: message });
      } else {
        socket.emit('sessionCreateError', message);
      }
    }
  });

  socket.on('session:launch', async ({ sessionId } = {}, ack) => {
    const targetSessionId = sessionId || socket.data?.sessionId;
    if (!targetSessionId) {
      const errorMessage = 'No session selected.';
      if (typeof ack === 'function') ack({ ok: false, error: errorMessage });
      else socket.emit('sessionLaunchError', errorMessage);
      return;
    }

    try {
      const session = await GameService.getCurrentGameSession(targetSessionId);
      const ownerTeamId = session.ownerTeamId;
      if (ownerTeamId && socket.data?.teamId && ownerTeamId !== socket.data.teamId) {
        const message = 'Only the session owner can launch the multiplayer mode.';
        if (typeof ack === 'function') ack({ ok: false, error: message });
        else socket.emit('sessionLaunchError', message);
        return;
      }

      const randomSettings = buildRandomMultiplayerSettings();
      await GameService.updateGameSettings(randomSettings, targetSessionId);

      stopPoolingMarketUpdates(targetSessionId);
      await GameService.startPrePurchasePhase(targetSessionId);

      const runtime = getSessionRuntime(targetSessionId);
      if (runtime) {
        runtime.remainingTime = randomSettings.roundTime || 180;
      }
      await startRoundTimer(targetSessionId, randomSettings.roundTime || 180);
      await broadcastGameState(targetSessionId);

      console.log(`🎮 Session ${targetSessionId} launched by socket ${socket.id}`);
      if (typeof ack === 'function') {
        ack({ ok: true, settings: randomSettings });
      }
    } catch (error) {
      console.error('Error launching session:', error);
      const message = error?.message || 'Failed to start multiplayer mode';
      if (typeof ack === 'function') ack({ ok: false, error: message });
      else socket.emit('sessionLaunchError', message);
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
        const targetSessionId = settings?.sessionId || socket.data?.sessionId || null;
        const { sessionId: _ignored, ...nextSettings } = settings || {};
        await GameService.updateGameSettings(nextSettings, targetSessionId || undefined);
        await broadcastGameState(targetSessionId || undefined);
        console.log('Game settings updated');

        // If simulation is running, apply timing changes immediately
        try {
          const session = await GameService.getCurrentGameSession(targetSessionId || undefined);
          if (session.settings?.currentPhase === 'simulation' && session.isActive) {
            startPoolingMarketUpdates(session.id);
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
        const sessionId = team.gameSessionId || socket.data?.sessionId;
        if (sessionId) {
          await broadcastGameState(sessionId);
        } else {
          await broadcastGameState();
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
        socket.emit('practiceError', 'Please register your team before starting practice mode.');
        return;
      }

      try {
        await humanTeam.update({ lastActiveAt: new Date() });
      } catch (e) {
        console.warn('Unable to refresh lastActiveAt for practice mode:', e?.message || e);
      }

      // Helpers for randomness
      const rnd = (min, max) => Math.random() * (max - min) + min;
      const irnd = (min, max) => Math.floor(rnd(min, max + 1));

      // Practice parameters
      const aiCount = Math.max(2, Math.min(6, Number(config.aiCount) || irnd(2, 5)));
      const prePurchaseDurationSec = 60; // always 1 minute
      const daysTotal = 365; // represent a year
      const daysPerUpdate = 7; // 7 days per update (semantic)

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
        simulatedWeeksPerUpdate: 7,
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
      const dynamicFixShare = Math.max(0, Math.min(0.95, (teams.length || 0) * FIX_SHARE_PER_TEAM));
      const poolingReserveRatio = Math.max(0.05, 1 - dynamicFixShare);
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
        const targetSessionId = socket.data?.sessionId || GameService.currentGameSession?.id;
        if (!targetSessionId) {
          socket.emit('error', 'No active session to end');
          return;
        }
        await autoEndCurrentPhase(targetSessionId);
      } catch (error) {
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
        const session = await GameService.startPrePurchasePhase(socket.data?.sessionId || undefined);
        io.to(getSessionRoom(session.id)).emit('phaseStarted', 'prePurchase');
        await broadcastGameState(session.id);
        console.log('Pre-purchase phase started');

        // Start round timer
        await startRoundTimer(session.id);
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
        const session = await GameService.startSimulationPhase(socket.data?.sessionId || undefined);
        io.to(getSessionRoom(session.id)).emit('phaseStarted', 'simulation');
        await broadcastGameState(session.id);
        console.log('Simulation phase started');

        // Start pooling market updates
        startPoolingMarketUpdates(session.id);

        // Start round timer
        await startRoundTimer(session.id);
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
        const session = await GameService.endPhase(socket.data?.sessionId || undefined);
        io.to(getSessionRoom(session.id)).emit('phaseEnded');
        await broadcastGameState(session.id);
        console.log('Current phase ended');

        // Stop pooling market updates when phase ends
        stopPoolingMarketUpdates(session.id);

        // Stop round timer when phase ends
        stopRoundTimer(session.id);
      } catch (error) {
        console.error('Error ending phase:', error);
        socket.emit('error', 'Failed to end phase');
      }
    }
  });

  // Run simulation (admin only)
  socket.on('runSimulation', async ({ sessionId } = {}) => {
    if (socket.id === adminSocket) {
      try {
        const targetSessionId = sessionId || socket.data?.sessionId || null;
        const simulationResults = await runMonthlySimulation(targetSessionId || undefined);
        if (targetSessionId) {
          io.to(getSessionRoom(targetSessionId)).emit('simulationResults', simulationResults);
          await broadcastGameState(targetSessionId);
        } else {
          io.emit('simulationResults', simulationResults);
          await broadcastGameState();
        }
        console.log('Simulation completed');
      } catch (error) {
        console.error('Error running simulation:', error);
        socket.emit('error', 'Failed to run simulation');
      }
    }
  });

  // Reset all game data (admin only)
  socket.on('resetAllData', async ({ sessionId } = {}) => {
    if (socket.id === adminSocket) {
      try {
        console.log('🔄 Admin resetting all game data...');
        const targetSessionId = sessionId || socket.data?.sessionId || null;
        const result = await GameService.resetAllData(targetSessionId);

        if (targetSessionId) {
          stopPoolingMarketUpdates(targetSessionId);
          stopRoundTimer(targetSessionId);
          clearSessionRuntime(targetSessionId);
          await broadcastGameState(targetSessionId);
          await broadcastSessionList();
          io.to(getSessionRoom(targetSessionId)).emit('dataReset', {
            message: 'Session data has been reset by admin',
            timestamp: new Date().toISOString()
          });
        } else {
          io.emit('dataReset', {
            message: 'All game data has been reset by admin',
            timestamp: new Date().toISOString()
          });

          for (const runtimeSessionId of [...sessionRuntimes.keys()]) {
            stopPoolingMarketUpdates(runtimeSessionId);
            stopRoundTimer(runtimeSessionId);
            clearSessionRuntime(runtimeSessionId);
          }
          await broadcastGameState();
          await broadcastSessionList();
        }

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
  socket.on('resetCurrentGame', async ({ sessionId } = {}) => {
    if (socket.id === adminSocket) {
      try {
        console.log('🔄 Admin resetting current game (keeping high scores)...');
        const targetSessionId = sessionId || socket.data?.sessionId || null;
        const result = await GameService.resetCurrentGame(targetSessionId);

        if (targetSessionId) {
          stopPoolingMarketUpdates(targetSessionId);
          stopRoundTimer(targetSessionId);
          clearSessionRuntime(targetSessionId);
          await broadcastGameState(targetSessionId);
          await broadcastSessionList();
          io.to(getSessionRoom(targetSessionId)).emit('currentGameReset', {
            message: 'Session has been reset by admin. High scores are preserved.',
            timestamp: new Date().toISOString()
          });
        } else {
          io.emit('currentGameReset', {
            message: 'Current game has been reset by admin. High scores are preserved.',
            timestamp: new Date().toISOString()
          });

          for (const runtimeSessionId of [...sessionRuntimes.keys()]) {
            stopPoolingMarketUpdates(runtimeSessionId);
            stopRoundTimer(runtimeSessionId);
            clearSessionRuntime(runtimeSessionId);
          }
          await broadcastGameState();
          await broadcastSessionList();
        }

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
  socket.on('getAnalytics', async ({ sessionId } = {}) => {
    if (socket.id !== adminSocket) {
      socket.emit('error', 'Unauthorized: Admin access required');
      return;
    }
    try {
      const targetSessionId = sessionId || socket.data?.sessionId || null;
      const analyticsData = await GameService.getAnalyticsData(targetSessionId || undefined);
      socket.emit('analyticsData', analyticsData);
    } catch (error) {
      console.error('Error getting analytics data:', error);
      socket.emit('error', 'Failed to get analytics data');
    }
  });

  // Broadcast game state to all clients
  socket.on('broadcastGameState', async ({ sessionId } = {}) => {
    try {
      const targetSessionId = sessionId || socket.data?.sessionId || null;
      if (targetSessionId) {
        await broadcastGameState(targetSessionId);
      } else {
        await broadcastGameState();
      }
    } catch (error) {
      console.error('Error broadcasting game state:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);

    try {
      const team = await Team.findOne({ where: { socketId: socket.id, isActive: true } });
      if (team) {
        await team.update({ socketId: null, lastActiveAt: new Date() });
        if (team.gameSessionId) {
          await broadcastGameState(team.gameSessionId);
        }
      }

      // Clear admin socket if admin disconnects
      if (adminSocket === socket.id) {
        adminSocket = null;
        const session = await GameService.getCurrentGameSession();
        await session.update({ adminSocketId: null });
      }

      await broadcastSessionList();
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Run monthly simulation for 12 months
async function runMonthlySimulation(sessionId = null) {
  const session = await GameService.getCurrentGameSession(sessionId || undefined);
  const teams = await GameService.getActiveTeams(session.id);
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
function createGameStatePayload(session, teams, runtime, socketId) {
  const sanitizeSettings = (settings) => {
    if (!settings || typeof settings !== 'object') return {};
    const { adminPassword, ...rest } = settings;
    const allocationDone = !!rest.fixSeatsAllocated;
    if (!allocationDone) {
      const { availableFixSeats, ...safe } = rest;
      return safe;
    }
    return rest;
  };

  return {
    teams: teams.map(team => {
      if (team.socketId !== socketId) {
        return {
          id: team.id,
          name: team.name,
          decisions: {
            ...team.decisions,
            fixSeatsPurchased: undefined,
            fixSeatsRequested: undefined,
            fixSeatBidPrice: undefined,
            fixSeatClearingPrice: undefined,
            fixSeatsAllocated: (session.settings?.fixSeatsAllocated ? team.decisions?.fixSeatsAllocated : undefined)
          },
          totalProfit: team.totalProfit,
          totalRevenue: team.totalRevenue
        };
      }
      return {
        id: team.id,
        name: team.name,
        decisions: {
          ...team.decisions,
          fixSeatsAllocated: (session.settings?.fixSeatsAllocated ? team.decisions?.fixSeatsAllocated : undefined)
        },
        totalProfit: team.totalProfit,
        totalRevenue: team.totalRevenue
      };
    }),
    currentRound: session.currentRound,
    isActive: session.isActive,
    remainingTime: runtime.remainingTime ?? session.settings?.remainingTime ?? 0,
    sessionId: session.id,
    sessionName: session.name,
    ownerTeamId: session.ownerTeamId ?? null,
    ...sanitizeSettings(session.settings)
  };
}
