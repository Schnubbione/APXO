import { Team as BaseTeam, GameSession as BaseGameSession, RoundResult as BaseRoundResult, HighScore as BaseHighScore } from './models.js';
import { Op } from 'sequelize';

let TeamModel = BaseTeam;
let GameSessionModel = BaseGameSession;
let RoundResultModel = BaseRoundResult;
let HighScoreModel = BaseHighScore;

export const __setModelsForTesting = ({ Team, GameSession, RoundResult, HighScore } = {}) => {
  if (Team) TeamModel = Team;
  if (GameSession) GameSessionModel = GameSession;
  if (RoundResult) RoundResultModel = RoundResult;
  if (HighScore) HighScoreModel = HighScore;
};

const SIMULATION_DEFAULT_DAYS = 365;
const SIMULATION_SECONDS_PER_DAY = 1;

const AGENT_BASE_CAPACITY = 180;

const AGENT_V1_DEFAULTS = Object.freeze({
  ticksTotal: SIMULATION_DEFAULT_DAYS,
  secondsPerTick: SIMULATION_SECONDS_PER_DAY,
  demandCurve: [6, 7, 8, 10, 12, 16, 20, 26, 34, 44, 58, 79],
  demandAlpha: 1.1,
  logitBeta: 6.0,
  referencePrice: 150,
  baselineCapacity: AGENT_BASE_CAPACITY,
  airline: {
    startPrice: 120,
    minPrice: 80,
    maxPrice: 400,
    gamma: 0.15,
    kappa: 50,
  },
});

// Game Service - Handles all game-related database operations
export class GameService {
  static currentGameSession = null;

  /**
   * Initialize or get current game session
   * @returns {Promise<GameSession>} The current active game session
   */
  static async getCurrentGameSession() {
    if (!this.currentGameSession) {
      // Try to find an active session
      let session = await GameSessionModel.findOne({
        where: { isActive: true },
        order: [['updatedAt', 'DESC']]
      });

      if (!session) {
        // Create new session if none exists
        session = await GameSessionModel.create({
          currentRound: 0,
          isActive: false,
          settings: {
            baseDemand: 100,
            spread: 50,
            shock: 0.1,
            sharedMarket: true,
            seed: 42,
            roundTime: 300,
            priceElasticity: -1.5,
            crossElasticity: 0.3,
            costVolatility: 0.05,
            demandVolatility: 0.1,
            marketConcentration: 0.7,
            currentPhase: 'prePurchase',
            phaseTime: 600,
            totalCapacity: 1000,
            totalAircraftSeats: 1000,
            totalFixSeats: 500,
            availableFixSeats: 500,
            fixSeatPrice: 60,
            poolingCost: 90,
            simulationMonths: 12,
            departureDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
            poolingMarketUpdateInterval: 1, // 1 second = 1 day
            simulatedWeeksPerUpdate: 1, // 1 day per update
            referencePrice: 199,
            marketPriceElasticity: -0.9,
            // Budget per team (equal for all teams)
            perTeamBudget: 20000
          }
        });
      }

      this.currentGameSession = session;
    }

    return this.currentGameSession;
  }

  /**
   * Update a team's decision (price, fix seats intent, pooling allocation, etc.)
   * @param {string} socketId - The socket ID of the team
   * @param {object} decision - The decision updates
   * @param {number} [decision.price] - Retail price for passengers
   * @param {number} [decision.fixSeatsPurchased] - Number of fix seats to purchase
   * @param {number} [decision.poolingAllocation] - Pooling allocation percentage (0-100)
   * @returns {Promise<Team|null>} The updated team or null if not found
   */
  static async updateTeamDecision(socketId, decision = {}) {
    const team = await TeamModel.findOne({ where: { socketId, isActive: true } });
    if (!team) return null;

    const session = await this.getCurrentGameSession();
    const settings = session.settings || {};

    // Build sanitized update
    const next = { ...(team.decisions || {}) };

    if (typeof decision.price === 'number' && !Number.isNaN(decision.price)) {
      // Clamp retail price to sensible bounds
      const p = Math.round(decision.price);
      next.price = Math.max(50, Math.min(500, p));
    }

    const isPrePurchasePhase = settings.currentPhase === 'prePurchase';

    if (typeof decision.fixSeatsPurchased === 'number' && Number.isFinite(decision.fixSeatsPurchased)) {
      if (isPrePurchasePhase) {
        // Only intent during pre-purchase; allocation happens separately at phase end
        const requested = Math.max(0, Math.floor(decision.fixSeatsPurchased));
        next.fixSeatsPurchased = requested;
        next.fixSeatsRequested = requested;
      }
    }

    if (typeof decision.poolingAllocation === 'number' && Number.isFinite(decision.poolingAllocation)) {
      if (isPrePurchasePhase) {
        // Percentage 0..100
        const pct = Math.max(0, Math.min(100, Math.round(decision.poolingAllocation)));
        next.poolingAllocation = pct;
      }
    }

    if (decision.fixSeatBidPrice !== undefined) {
      if (isPrePurchasePhase) {
        const bid = Number(decision.fixSeatBidPrice);
        if (Number.isFinite(bid) && bid > 0) {
          next.fixSeatBidPrice = Math.round(bid);
        } else {
          next.fixSeatBidPrice = null;
        }
      }
    }

    // Agent v1 live controls: can be set during simulation phase
    if (!isPrePurchasePhase) {
      if (decision.push_level !== undefined) {
        const lvl = Number(decision.push_level);
        if ([0,1,2].includes(lvl)) next.push_level = lvl;
      }
      if (decision.fix_hold_pct !== undefined) {
        const pct = Math.max(0, Math.min(100, Math.round(Number(decision.fix_hold_pct))));
        next.fix_hold_pct = pct;
      }
      if (decision.tool !== undefined) {
        const allowed = ['none','hedge','spotlight','commit'];
        const tool = typeof decision.tool === 'string' && allowed.includes(decision.tool) ? decision.tool : 'none';
        next.tool = tool;
      }
    }

    if (team.decisions && typeof team.decisions.fixSeatsAllocated === 'number') {
      next.fixSeatsAllocated = team.decisions.fixSeatsAllocated;
    }

    await team.update({ decisions: next });
    return team;
  }

  /**
   * Get all active teams for current session
   * @returns {Promise<Team[]>} Array of active teams
   */
  static async getActiveTeams() {
    const session = await this.getCurrentGameSession();
    return await TeamModel.findAll({
      where: { isActive: true },
      include: [{
        model: RoundResultModel,
        where: { gameSessionId: session.id },
        required: false
      }]
    });
  }

  /**
   * Register a new team
   * @param {string} socketId - The socket ID of the connecting client
   * @param {string} teamName - The name of the team to register
   * @returns {Promise<Team>} The registered team
   * @throws {Error} If team name is invalid or already exists
   */
  static async registerTeam(socketId, teamName) {
    try {
      // Normalize and validate input
      const normalizedName = (teamName || '').trim();
      if (!normalizedName) {
        throw new Error('Please enter a team name.');
      }
      if (normalizedName.length > 64) {
        throw new Error('Team name is too long (max 64 characters).');
      }

      // Check if a round is currently active
      const session = await this.getCurrentGameSession();
      if (session.isActive) {
        throw new Error('Cannot join the game while a round is in progress. Please wait for the current round to end.');
      }

      // Check if any team with this name exists (active or inactive)
      const anyTeamWithName = await TeamModel.findOne({ where: { name: normalizedName } });

      if (anyTeamWithName) {
        if (anyTeamWithName.isActive) {
          // Active team with same name -> block with friendly error
          throw new Error('This team name is already in use. Please choose a different name.');
        }

        // Reactivate existing inactive team: reset to a clean state and reuse the row
        const defaultDecisions = {
          price: 500,
          fixSeatsPurchased: 0,
          fixSeatsAllocated: 0,
          poolingAllocation: 0
        };

        // Optionally wipe current-session round results for this team to avoid leftovers
        try {
          const session = await this.getCurrentGameSession();
          await RoundResultModel.destroy({ where: { teamId: anyTeamWithName.id, gameSessionId: session.id } });
        } catch (e) {
          // Non-fatal: continue even if cleanup fails
          console.warn('Warning cleaning old round results for reactivated team:', e?.message || e);
        }

        // Generate a new resume token for this session
        const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

        const resumeUntil = new Date(Date.now() + 5 * 60 * 1000);
        await anyTeamWithName.update({
          socketId,
          isActive: true,
          resumeToken: token,
          resumeUntil,
          decisions: defaultDecisions,
          totalProfit: 0,
          totalRevenue: 0
        });

        return anyTeamWithName;
      }

      // No existing team with that name -> create fresh
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const resumeUntil = new Date(Date.now() + 5 * 60 * 1000);
      const team = await TeamModel.create({
        socketId,
        name: normalizedName,
        resumeToken: token,
        resumeUntil,
        decisions: {
          price: 500,
          fixSeatsPurchased: 0,
          poolingAllocation: 0
        },
        totalProfit: 0,
        totalRevenue: 0
      });

      return team;
    } catch (error) {
      // Map unique constraint errors to a friendly message
      if (error && (error.name === 'SequelizeUniqueConstraintError' || /unique/i.test(error.message || ''))) {
        throw new Error('This team name is already in use. Please choose a different name.');
      }
      throw error;
    }
  }

  // Resume an existing team using a resume token
  static async resumeTeam(socketId, token) {
    if (!token) return null;
    const team = await TeamModel.findOne({ where: { resumeToken: token } });
    if (!team) return null;
  const resumeUntil = new Date(Date.now() + 5 * 60 * 1000);
  await team.update({ socketId, isActive: true, resumeUntil });
    return team;
  }

  // Explicit logout: prevent resume by clearing token until next registration
  static async logoutTeam(socketId) {
    const team = await TeamModel.findOne({ where: { socketId } });
    if (!team) return null;
    await team.update({ isActive: false, socketId: null, resumeToken: null });
    return team;
  }

    // Allocate fix seats at end of first round
  static async allocateFixSeats() {
    const session = await this.getCurrentGameSession();
    const teams = await this.getActiveTeams();
    const settings = session.settings || {};

    const totalCapacity = settings.totalAircraftSeats || 1000;
    const poolingReserveRatio = 0.3; // Airline keeps 30% for pooling
    const maxFixCapacity = Math.floor(totalCapacity * (1 - poolingReserveRatio));

    // Collect all requests with bids (cap by budget in first round)
    const defaultUnitPrice = Number(settings.fixSeatPrice || 60) || 60;
    const requests = teams.map(team => {
      const rawRequested = Math.max(0, Math.floor(Number(team.decisions?.fixSeatsPurchased || 0)));
      const rawBid = team.decisions?.fixSeatBidPrice ?? defaultUnitPrice;
      const normalizedBid = Number.isFinite(Number(rawBid)) && Number(rawBid) > 0
        ? Math.round(Number(rawBid))
        : defaultUnitPrice;
      let cappedRequested = rawRequested;
      if ((session.currentRound || 0) === 0) {
        const budget = Number(settings.perTeamBudget || 0);
        if (budget > 0 && normalizedBid > 0) {
          cappedRequested = Math.min(cappedRequested, Math.floor(budget / normalizedBid));
        }
      }
      return {
        team,
        teamId: team.id,
        teamName: team.name,
        requestedOriginal: rawRequested,
        requested: Math.max(0, cappedRequested),
        bidPrice: normalizedBid
      };
    });

    // Sort descending by bid price, then by team id for determinism
    const sortedRequests = [...requests].sort((a, b) => {
      if (b.bidPrice !== a.bidPrice) return b.bidPrice - a.bidPrice;
      return a.teamId.localeCompare(b.teamId);
    });

    let remainingCapacity = maxFixCapacity;
    const allocationMap = new Map();

    // Group by bid price to allow proportional allocation within price tiers
    const grouped = new Map();
    for (const req of sortedRequests) {
      if (!grouped.has(req.bidPrice)) grouped.set(req.bidPrice, []);
      grouped.get(req.bidPrice).push(req);
    }

    for (const [price, group] of grouped.entries()) {
      if (remainingCapacity <= 0) break;
      const totalGroupRequested = group.reduce((sum, req) => sum + req.requested, 0);
      if (totalGroupRequested <= 0) {
        group.forEach(req => allocationMap.set(req.teamId, { allocated: 0, price }));
        continue;
      }

      if (totalGroupRequested <= remainingCapacity) {
        // Everyone in this tier gets all requested seats
        for (const req of group) {
          allocationMap.set(req.teamId, { allocated: req.requested, price });
          remainingCapacity -= req.requested;
        }
        continue;
      }

      // Not enough seats for this price tier: allocate proportionally
      const ratio = remainingCapacity / totalGroupRequested;
      const provisional = group.map(req => {
        const exact = req.requested * ratio;
        const base = Math.floor(exact);
        const remainder = exact - base;
        return { req, base, remainder };
      });
      let seatsLeft = remainingCapacity - provisional.reduce((sum, item) => sum + item.base, 0);

      // Distribute leftover seats to highest remainder (stable tie-breaker by team id)
      provisional.sort((a, b) => {
        if (b.remainder !== a.remainder) return b.remainder - a.remainder;
        return a.req.teamId.localeCompare(b.req.teamId);
      });
      for (const item of provisional) {
        let extra = 0;
        if (seatsLeft > 0) {
          extra = 1;
          seatsLeft -= 1;
        }
        const finalAlloc = item.base + extra;
        allocationMap.set(item.req.teamId, { allocated: finalAlloc, price });
      }
      remainingCapacity = 0;
    }

    const allocations = [];
    for (const req of requests) {
      const allocInfo = allocationMap.get(req.teamId) || { allocated: 0, price: req.bidPrice };
      const allocated = Math.max(0, Math.min(req.requested, allocInfo.allocated || 0));
      const clearingPrice = allocated > 0 ? allocInfo.price : null;

      const updatedDecisions = {
        ...req.team.decisions,
        fixSeatsRequested: req.requested,
        fixSeatsPurchased: allocated,
        fixSeatsAllocated: allocated,
        fixSeatBidPrice: req.bidPrice,
        fixSeatClearingPrice: clearingPrice
      };

      await req.team.update({ decisions: updatedDecisions });

      allocations.push({
        teamId: req.teamId,
        teamName: req.teamName,
        requested: req.requested,
        bidPrice: req.bidPrice,
        allocated,
        clearingPrice
      });
    }

    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocated, 0);
    const updatedSettings = {
      ...settings,
      availableFixSeats: maxFixCapacity - totalAllocated,
      poolingReserveCapacity: totalCapacity - totalAllocated,
      fixSeatsAllocated: true, // Mark that allocation has happened
      // Initialize pooling market
      poolingMarket: {
        currentPrice: 150, // Starting pooling price
        totalPoolingCapacity: totalCapacity - totalAllocated,
        availablePoolingCapacity: totalCapacity - totalAllocated,
        lastUpdate: new Date().toISOString(),
        priceHistory: [{ price: 150, timestamp: new Date().toISOString() }]
      }
    };

    await session.update({ settings: updatedSettings });
    session.settings = updatedSettings;

    console.log(`✅ Fix seats allocated via auction: ${totalAllocated}/${maxFixCapacity} seats`);
    console.log(`🏊 Pooling market initialized with ${totalCapacity - totalAllocated} seats at €${150}`);

    return {
      allocations,
      totalRequested: requests.reduce((sum, req) => sum + req.requested, 0),
      totalAllocated,
      maxFixCapacity,
      poolingReserveCapacity: totalCapacity - totalAllocated
    };
  }

  // Update game settings
  static async updateGameSettings(settings) {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};
    let updatedSettings = { ...currentSettings, ...settings };

    if (Array.isArray(settings.demandCurve) && settings.demandCurve.length > 0) {
      updatedSettings.originalDemandCurve = settings.demandCurve.map(point => Number(point));
      updatedSettings.demandCurveCapacity = undefined;
    }
    if (settings.baseDemand !== undefined && Number.isFinite(Number(settings.baseDemand))) {
      updatedSettings.originalBaseDemand = Number(settings.baseDemand);
    }
    if (settings.totalAircraftSeats !== undefined && updatedSettings.demandCurveBaselineCapacity === undefined) {
      updatedSettings.demandCurveBaselineCapacity = AGENT_V1_DEFAULTS.baselineCapacity;
    }

    // If totalAircraftSeats is being updated, adjust related parameters dynamically
    if (settings.totalAircraftSeats !== undefined) {
      const newTotalSeats = settings.totalAircraftSeats;
      const oldTotalSeats = currentSettings.totalAircraftSeats || 1000;

      // Scale totalCapacity proportionally (keep same ratio)
      const capacityRatio = (currentSettings.totalCapacity || 1000) / oldTotalSeats;
      updatedSettings.totalCapacity = Math.round(newTotalSeats * capacityRatio);

      // Scale totalFixSeats proportionally (keep same ratio)
      const fixSeatsRatio = (currentSettings.totalFixSeats || 500) / oldTotalSeats;
      updatedSettings.totalFixSeats = Math.round(newTotalSeats * fixSeatsRatio);
      updatedSettings.availableFixSeats = Math.round(newTotalSeats * fixSeatsRatio);

      // Scale pooling reserve capacity proportionally
      const poolingRatio = (currentSettings.poolingReserveCapacity || 300) / oldTotalSeats;
      updatedSettings.poolingReserveCapacity = Math.round(newTotalSeats * poolingRatio);

      // Update pooling market if it exists
      if (updatedSettings.poolingMarket) {
        updatedSettings.poolingMarket = {
          ...updatedSettings.poolingMarket,
          totalPoolingCapacity: Math.round(newTotalSeats * poolingRatio),
          availablePoolingCapacity: Math.round(newTotalSeats * poolingRatio)
        };
      }

      console.log(`✈️ Total aircraft seats updated: ${oldTotalSeats} → ${newTotalSeats}`);
      console.log(`📊 Adjusted parameters: totalCapacity=${updatedSettings.totalCapacity}, totalFixSeats=${updatedSettings.totalFixSeats}`);
    }

    await session.update({ settings: updatedSettings });
    session.settings = updatedSettings;
    return session;
  }

  // Start pre-purchase phase
  static async startPrePurchasePhase() {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};
    const updatedSettings = {
      ...currentSettings,
      currentPhase: 'prePurchase',
      isActive: true,
    };

    // Set both the top-level session flag and the settings flag for compatibility
    await session.update({ settings: updatedSettings, isActive: true });
    session.settings = updatedSettings;
    session.isActive = true;
    return session;
  }

  // Start simulation phase
  static async startSimulationPhase() {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};

    const configuredTicks = Number.isFinite(Number(currentSettings.simulationTicksTotal))
      ? Math.max(1, Math.floor(Number(currentSettings.simulationTicksTotal)))
      : SIMULATION_DEFAULT_DAYS;

    const simulationHorizon = Math.max(SIMULATION_DEFAULT_DAYS, configuredTicks);
    const secondsPerDay = SIMULATION_SECONDS_PER_DAY;
    const secondsPerTick = secondsPerDay;
    const dayStep = 1;

    const teams = await this.getActiveTeams();
    const totalSeats = currentSettings.totalAircraftSeats || 1000;
    const baselineCapacity = Number.isFinite(Number(currentSettings.demandCurveBaselineCapacity))
      ? Math.max(1, Number(currentSettings.demandCurveBaselineCapacity))
      : AGENT_V1_DEFAULTS.baselineCapacity;
    const originalDemandCurve = Array.isArray(currentSettings.originalDemandCurve) && currentSettings.originalDemandCurve.length > 0
      ? currentSettings.originalDemandCurve
      : (Array.isArray(currentSettings.demandCurve) && currentSettings.demandCurve.length > 0
        ? currentSettings.demandCurve
        : AGENT_V1_DEFAULTS.demandCurve);
    const sanitizedCurve = originalDemandCurve.map(point => Math.max(0, Number(point) || 0));
    const baselineCurveSum = sanitizedCurve.reduce((sum, value) => sum + value, 0) || 1;
    const seatScaleRaw = totalSeats > 0 ? totalSeats / baselineCurveSum : 1;
    const seatScale = Number.isFinite(seatScaleRaw) && seatScaleRaw > 0 ? seatScaleRaw : 1;
    const scaledDemandCurve = sanitizedCurve.map(point => Math.max(0, Math.round(point * seatScale)));
    const scaledDemandTotal = scaledDemandCurve.reduce((sum, value) => sum + value, 0);
    const originalBaseDemand = Number.isFinite(Number(currentSettings.originalBaseDemand))
      ? Math.max(0, Number(currentSettings.originalBaseDemand))
      : Math.max(0, Number.isFinite(Number(currentSettings.baseDemand)) ? Number(currentSettings.baseDemand) : 100);
    const scaledBaseDemand = Math.max(1, Math.round(scaledDemandTotal / Math.max(1, simulationHorizon)));

    const perTeamState = {};
    let committedFix = 0;
    for (const t of teams) {
      const fixRem = Math.max(0, t.decisions?.fixSeatsAllocated || 0);
      const clearingPrice = Number.isFinite(Number(t.decisions?.fixSeatClearingPrice)) && Number(t.decisions?.fixSeatClearingPrice) > 0
        ? Number(t.decisions?.fixSeatClearingPrice)
        : (currentSettings.fixSeatPrice || 60);
      const fixCost = fixRem * clearingPrice;
      committedFix += fixRem;
      perTeamState[t.id] = {
        fixRemaining: fixRem,
        poolRemaining: 0,
        sold: 0,
        poolUsed: 0,
        demand: 0,
        initialFix: fixRem,
        initialPool: 0,
        revenue: 0,
        cost: fixCost,
        insolvent: false
      };
    }

    const airlinePassThroughCapacity = Math.max(0, totalSeats - committedFix);
    const existingMarket = currentSettings.poolingMarket || {};
    const initialAirlinePrice = Number.isFinite(Number(existingMarket.currentPrice)) && existingMarket.currentPrice > 0
      ? existingMarket.currentPrice
      : (currentSettings.poolingCost || AGENT_V1_DEFAULTS.airline.startPrice);
    const initialPriceHistory = existingMarket.priceHistory && Array.isArray(existingMarket.priceHistory) && existingMarket.priceHistory.length > 0
      ? existingMarket.priceHistory
      : [{ price: initialAirlinePrice, timestamp: new Date().toISOString() }];

    const updatedPM = {
      currentPrice: initialAirlinePrice,
      totalPoolingCapacity: airlinePassThroughCapacity,
      availablePoolingCapacity: airlinePassThroughCapacity,
      priceHistory: initialPriceHistory,
      lastUpdate: new Date().toISOString(),
      currentDemand: 0,
      soldThisTick: 0,
      unmetDemand: 0
    };

    const rngSeed = Number.isFinite(Number(currentSettings.simRngSeed))
      ? Number(currentSettings.simRngSeed)
      : Math.floor(Math.random() * 1e9);

    const updatedSettings = {
      ...currentSettings,
      currentPhase: 'simulation',
      isActive: true,
      simulatedDaysUntilDeparture: simulationHorizon,
      simulationHorizon,
      simulationTicksTotal: simulationHorizon,
      secondsPerDay,
      poolingMarketUpdateInterval: secondsPerDay,
      simulatedWeeksPerUpdate: dayStep,
      secondsPerTick,
      demandCurve: scaledDemandCurve,
      originalDemandCurve,
      demandCurveCapacity: totalSeats,
      demandCurveBaselineCapacity: baselineCapacity,
      baseDemand: scaledBaseDemand,
      originalBaseDemand,
      priceAlpha: currentSettings.priceAlpha ?? AGENT_V1_DEFAULTS.demandAlpha,
      priceBeta: currentSettings.priceBeta ?? AGENT_V1_DEFAULTS.logitBeta,
      referencePrice: currentSettings.referencePrice ?? AGENT_V1_DEFAULTS.referencePrice,
      airlinePriceGamma: currentSettings.airlinePriceGamma ?? AGENT_V1_DEFAULTS.airline.gamma,
      airlinePriceKappa: currentSettings.airlinePriceKappa ?? AGENT_V1_DEFAULTS.airline.kappa,
      airlinePriceMin: currentSettings.airlinePriceMin ?? AGENT_V1_DEFAULTS.airline.minPrice,
      airlinePriceMax: currentSettings.airlinePriceMax ?? AGENT_V1_DEFAULTS.airline.maxPrice,
      poolingMarket: updatedPM,
      simState: { perTeam: perTeamState, returnedDemandRemaining: 0 },
      airlineCapacityInitial: totalSeats,
      airlineCapacityFixedCommitted: committedFix,
      airlineCapacityRemaining: airlinePassThroughCapacity,
      airlineSalesCumulative: Number.isFinite(Number(currentSettings.airlineSalesCumulative))
        ? Number(currentSettings.airlineSalesCumulative)
        : 0,
      simRngSeed: rngSeed >>> 0,
      simRngState: (rngSeed >>> 0),
      poolingCost: initialAirlinePrice
    };

    await session.update({ settings: updatedSettings, isActive: true });
    session.settings = updatedSettings;
    session.isActive = true;
    return session;
  }

  // End current phase
  static async endPhase() {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};
    const currentPhase = currentSettings.currentPhase;
    let nextPhase = currentPhase;
    if (currentPhase === 'prePurchase') {
      nextPhase = 'simulation';
    } else if (currentPhase === 'simulation') {
      nextPhase = 'prePurchase';
    }

    const updatedSettings = {
      ...currentSettings,
      isActive: false,
      currentPhase: nextPhase
    };

    // Unset both the top-level session flag and the settings flag for compatibility
    await session.update({ settings: updatedSettings, isActive: false });
    session.settings = updatedSettings;
    session.isActive = false;
    return session;
  }

  // End current round and calculate results
  static async endRound(calculateRoundResults) {
    const session = await this.getCurrentGameSession();
    const teams = await this.getActiveTeams();
    const settings = session.settings || {};
    const simState = settings.simState && settings.simState.perTeam ? settings.simState.perTeam : null;
    let roundResults;
    if (simState) {
      const defaultPoolingCost = settings.poolingCost || 90;
      const pmHist = settings.poolingMarket && Array.isArray(settings.poolingMarket.priceHistory) ? settings.poolingMarket.priceHistory : [];
      const avgPoolingUnit = pmHist.length > 0 ? Math.round(pmHist.reduce((s, p) => s + (p.price || 0), 0) / pmHist.length) : defaultPoolingCost;

      const results = teams.map(team => {
        const st = simState[team.id] || { fixRemaining: 0, poolRemaining: 0, sold: 0, poolUsed: 0, demand: 0, initialFix: 0, initialPool: 0 };
        const sold = Math.max(0, Math.round(st.sold || 0));
        const poolUsed = Math.max(0, Math.round(st.poolUsed || 0));
        const initialFix = Math.max(0, Math.round(st.initialFix || ((team.decisions?.fixSeatsAllocated) || 0)));
        const initialPool = Math.max(0, Math.round(st.initialPool || Math.round((settings.totalAircraftSeats || 1000) * ((team.decisions?.poolingAllocation || 0) / 100))));
        const capacity = initialFix + initialPool;
        const price = team.decisions?.price || 500;
        const clearingPrice = Number.isFinite(Number(team.decisions?.fixSeatClearingPrice)) && Number(team.decisions?.fixSeatClearingPrice) > 0
          ? Number(team.decisions?.fixSeatClearingPrice)
          : (settings.fixSeatPrice || 60);
        const passengerRevenue = st.revenue || (sold * price);
        const fixSeatCost = initialFix * clearingPrice;
        const poolingUsageCost = poolUsed * avgPoolingUnit;
        const operationalCost = sold * 15;
        const totalCost = st.cost || (fixSeatCost + poolingUsageCost + operationalCost);
        const profit = Math.round(passengerRevenue - totalCost);
        const demand = Math.max(0, Math.round(st.demand || 0));
        const unsold = Math.max(0, demand - sold);
        const budget = Number(settings.perTeamBudget || 0);
        const flaggedEarly = !!st.insolvent;
        const insolvent = (profit < 0 && Math.abs(profit) > budget && (session.currentRound || 0) > 0)
          || (flaggedEarly && profit < 0 && Math.abs(profit) > budget);
        return {
          teamId: team.id,
          sold,
          revenue: Math.round(passengerRevenue),
          cost: Math.round(totalCost),
          profit,
          unsold,
          marketShare: 0,
          demand,
          avgPrice: price,
          capacity,
          insolvent
        };
      });

      const totalSold = results.reduce((s, r) => s + r.sold, 0) || 1;
      roundResults = results.map(r => ({ ...r, marketShare: Math.round((r.sold / totalSold) * 100) / 100 }));
    } else {
      // Fallback to legacy calculator
      roundResults = calculateRoundResults(teams, settings);
    }

    // Save round results to database
    const savedResults = [];
  for (const result of roundResults) {
      const team = teams.find(t => t.id === result.teamId);
      if (team) {
        // Update team's total profit
        const newTotalProfit = parseFloat(team.totalProfit || 0) + parseFloat(result.profit || 0);
        const newTotalRevenue = parseFloat(team.totalRevenue || 0) + parseFloat(result.revenue || 0);
        await team.update({ totalProfit: newTotalProfit, totalRevenue: newTotalRevenue });

        // Save round result
        const roundResult = await RoundResultModel.create({
          gameSessionId: session.id,
          roundNumber: session.currentRound,
          teamId: result.teamId,
          sold: result.sold,
          revenue: result.revenue,
          cost: result.cost,
          profit: result.profit,
          unsold: result.unsold,
          marketShare: result.marketShare,
          demand: result.demand,
          avgPrice: result.avgPrice,
          capacity: result.capacity,
          insolvent: !!result.insolvent
        });

        savedResults.push({
          ...result,
          totalProfit: newTotalProfit,
          totalRevenue: newTotalRevenue
        });
      }
    }

  // Increment round number
    const nextRound = session.currentRound + 1;

    // Update session: increment round (no automatic game completion)
  await session.update({
      currentRound: nextRound,
      isActive: false
    });

    console.log(`Round ${session.currentRound} completed. Moving to round ${nextRound}. Game continues until admin ends it.`);

    return {
      results: savedResults,
      isGameComplete: false, // Game never completes automatically
      currentRound: nextRound
    };
  }

  // Get analytics data
  static async getAnalyticsData() {
    const session = await this.getCurrentGameSession();
    const teams = await this.getActiveTeams();

    // Get round history
    const roundHistory = await RoundResultModel.findAll({
      where: { gameSessionId: session.id },
      include: [{
        model: Team,
        attributes: ['name']
      }],
      order: [['roundNumber', 'ASC'], ['timestamp', 'ASC']]
    });

    // Group by rounds
    const roundsMap = new Map();
    roundHistory.forEach(result => {
      const roundKey = result.roundNumber;
      if (!roundsMap.has(roundKey)) {
        roundsMap.set(roundKey, {
          roundNumber: roundKey,
          timestamp: result.timestamp,
          teamResults: [],
          totalDemand: 0,
          totalSold: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0
        });
      }

      const round = roundsMap.get(roundKey);
      round.teamResults.push({
        teamId: result.teamId,
        teamName: result.Team?.name,
        sold: result.sold,
        revenue: parseFloat(result.revenue),
        cost: parseFloat(result.cost),
        profit: parseFloat(result.profit),
        unsold: result.unsold,
        marketShare: parseFloat(result.marketShare),
        demand: result.demand,
        avgPrice: parseFloat(result.avgPrice),
        capacity: result.capacity
      });

      round.totalDemand += result.demand;
      round.totalSold += result.sold;
      round.totalRevenue += parseFloat(result.revenue);
      round.totalCost += parseFloat(result.cost);
      round.totalProfit += parseFloat(result.profit);
    });

    const roundHistoryArray = Array.from(roundsMap.values());

    // Create leaderboard
    const leaderboard = teams.map(team => {
      const totalRevenue = parseFloat(team.totalRevenue || 0);
      const totalProfit = parseFloat(team.totalProfit || 0);
      return {
        name: team.name,
        revenue: totalRevenue,
        profit: totalProfit,
        marketShare: 0, // Will be calculated if needed
        avgPrice: team.decisions?.price || 500,
        capacity: (team.decisions?.fixSeatsAllocated ?? team.decisions?.fixSeatsPurchased ?? 0) + Math.round(((team.decisions?.poolingAllocation || 0) / 100) * 1000)
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return {
      roundHistory: roundHistoryArray,
      currentGameState: {
        ...session.toJSON(),
        teams: teams.map(team => team.toJSON())
      },
      leaderboard
    };
  }

  // Get high scores across all sessions
  static async getHighScores(limit = 10) {
    return await HighScoreModel.findAll({
      order: [['totalRevenue', 'DESC']],
      limit,
      include: [{
        model: GameSessionModel,
        attributes: ['createdAt']
      }]
    });
  }

  // Save high score
  static async saveHighScore(teamName, totalRevenue, roundsPlayed, gameSessionId) {
    const avgRevenuePerRound = roundsPlayed > 0 ? totalRevenue / roundsPlayed : 0;

    return await HighScoreModel.create({
      teamName,
      totalRevenue,
      roundsPlayed,
      avgRevenuePerRound,
      gameSessionId
    });
  }

  // Get current game state (for broadcasting)
  static async getCurrentGameState(socketId = null) {
    const session = await this.getCurrentGameSession();
    const activeTeams = await this.getActiveTeams();

    // Sanitize settings to avoid leaking sensitive keys like adminPassword
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

    // If socketId is provided, hide other teams' fix seat purchases for privacy
    const teamsData = activeTeams.map(team => {
      if (socketId && team.socketId !== socketId) {
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
            // Hide allocated before allocation has happened
            fixSeatsAllocated: (session.settings?.fixSeatsAllocated ? team.decisions?.fixSeatsAllocated : undefined)
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
            fixSeatsAllocated: (session.settings?.fixSeatsAllocated ? team.decisions?.fixSeatsAllocated : undefined)
          },
          totalProfit: team.totalProfit
        };
      }
    });

    return {
      teams: teamsData,
      currentRound: session.currentRound,
      isActive: session.isActive,
      ...sanitizeSettings(session.settings)
    };
  }

  // Update pooling market prices and availability
  static async updatePoolingMarket() {
    const session = await this.getCurrentGameSession();
    const teams = await this.getActiveTeams();
    const settings = session.settings || {};
    const poolingMarket = settings.poolingMarket || {};
    const simState = settings.simState || { perTeam: {}, returnedDemandRemaining: 0 };
    const totalSeatsSetting = settings.totalAircraftSeats || 1000;

    const perTeam = simState.perTeam || {};
    const aliveTeams = teams;

    const horizon = Number.isFinite(Number(settings.simulationHorizon))
      ? Math.max(1, Math.floor(Number(settings.simulationHorizon)))
      : AGENT_V1_DEFAULTS.ticksTotal;
    const daysRemaining = Number.isFinite(Number(settings.simulatedDaysUntilDeparture)) ? Math.max(0, Number(settings.simulatedDaysUntilDeparture)) : horizon;

    const dayStep = Number.isFinite(Number(settings.simulatedWeeksPerUpdate)) && Number(settings.simulatedWeeksPerUpdate) > 0
      ? Number(settings.simulatedWeeksPerUpdate)
      : 1;
    const nextDays = Math.max(0, daysRemaining - dayStep);
    const dayElapsed = Math.max(0, Math.min(horizon - 1, horizon - nextDays));
    const progress = horizon > 0 ? (horizon - nextDays) / horizon : 0;

    const demandCurve = Array.isArray(settings.demandCurve) && settings.demandCurve.length > 0
      ? settings.demandCurve
      : AGENT_V1_DEFAULTS.demandCurve;
    let curveSample = undefined;
    if (Array.isArray(demandCurve) && demandCurve.length > 0) {
      const cappedIndex = Math.min(dayElapsed, demandCurve.length - 1);
      curveSample = demandCurve[cappedIndex];
    }
    const periods = Math.max(1, demandCurve.length || 1);
    const periodLength = Math.max(1, Math.round(horizon / periods));
    let baseDemandRaw = 0;
    if (curveSample !== undefined) {
      const baseDemandCandidate = Number(curveSample);
      baseDemandRaw = Number.isFinite(baseDemandCandidate) ? Math.max(0, baseDemandCandidate / periodLength) : 0;
    } else {
      const fallback = Number(settings.baseDemand ?? 0);
      baseDemandRaw = Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
    }
    const committedFixForecast = Math.max(0, Number(settings.airlineCapacityFixedCommitted ?? 0));
    const passThroughForecast = Math.max(0, Number(settings.airlineCapacityInitial ?? settings.totalAircraftSeats ?? 1000) - committedFixForecast);
    const totalSeatsForecast = committedFixForecast + passThroughForecast;
    const cumulativeSalesToDate = Math.max(0, Number(settings.airlineSalesCumulative ?? 0));
    const remainingCapacityTarget = Math.max(0, totalSeatsForecast - cumulativeSalesToDate);
    const smoothingDemand = Math.max(0, Math.round(remainingCapacityTarget / Math.max(1, daysRemaining + 1)));
    const baseDemand = Math.max(0, Math.round((baseDemandRaw + smoothingDemand) / 2));
    const volatility = Math.abs(settings.demandVolatility ?? 0.1);

    const rngSeedBase = Number.isFinite(Number(settings.simRngState))
      ? Number(settings.simRngState) >>> 0
      : (Number.isFinite(Number(settings.simRngSeed)) ? Number(settings.simRngSeed) >>> 0 : (Math.floor(Math.random() * 1e9) >>> 0));
    let rngState = rngSeedBase;
    const nextRandom = () => {
      rngState = (rngState * 1664525 + 1013904223) >>> 0;
      return rngState / 0xffffffff;
    };

    const demandNoise = (nextRandom() * 2 - 1) * volatility;

    if (aliveTeams.length === 0) {
      const updatedSettings = {
        ...settings,
        simulatedDaysUntilDeparture: nextDays,
        simRngState: rngState
      };
      await session.update({ settings: updatedSettings });
      session.settings = updatedSettings;
      const phaseCompleted = nextDays <= 0;
      return {
        ...poolingMarket,
        phaseCompleted,
        ticksRemaining: nextDays,
      };
    }

    const minPrice = aliveTeams.reduce((min, team) => {
      const price = typeof team.decisions?.price === 'number' ? team.decisions.price : 500;
      return Math.min(min, price);
    }, Infinity);

    const referenceCurve = Array.isArray(settings.referencePriceCurve) ? settings.referencePriceCurve : null;
    const refPrice = Number((referenceCurve?.[dayElapsed] ?? settings.referencePrice ?? minPrice) || AGENT_V1_DEFAULTS.referencePrice);
    const referencePrice = Math.max(1, refPrice);
    const priceAlpha = Math.abs(settings.priceAlpha ?? AGENT_V1_DEFAULTS.demandAlpha);

    const priceRatio = (minPrice - referencePrice) / Math.max(referencePrice, 1);
    const demandScale = Math.exp(-priceAlpha * priceRatio);
    const totalDemandRaw = Math.max(0, Math.round(baseDemand * Math.max(0, 1 + demandNoise) * demandScale));
    const demandMin = Number.isFinite(Number(settings.demandMin)) ? Math.max(0, Number(settings.demandMin)) : 0;
    const demandMax = Number.isFinite(Number(settings.demandMax)) ? Math.max(demandMin, Number(settings.demandMax)) : Number.POSITIVE_INFINITY;
    const totalDemand = Math.max(demandMin, Math.min(demandMax, totalDemandRaw));

    const priceBeta = Math.abs(settings.priceBeta ?? AGENT_V1_DEFAULTS.logitBeta);
    const priceWeights = aliveTeams.map(team => {
      const price = Math.max(1, typeof team.decisions?.price === 'number' ? team.decisions.price : 500);
      const relative = price / Math.max(1, minPrice);
      return Math.max(Math.exp(-priceBeta * (relative - 1)), 0.0001);
    });
    const totalWeight = priceWeights.reduce((sum, w) => sum + w, 0) || aliveTeams.length;
    const desiredDemand = aliveTeams.map((_, idx) => (totalDemand * priceWeights[idx]) / totalWeight);

    const demandInt = desiredDemand.map(Math.floor);
    let remainder = totalDemand - demandInt.reduce((sum, val) => sum + val, 0);
    const remainders = desiredDemand.map((value, idx) => ({ idx, frac: value - Math.floor(value) }));
    remainders.sort((a, b) => b.frac - a.frac || a.idx - b.idx);
    for (const item of remainders) {
      if (remainder <= 0) break;
      demandInt[item.idx] += 1;
      remainder -= 1;
    }

    const rankedTeams = aliveTeams.map((team, idx) => ({ team, idx }))
      .sort((a, b) => {
        const priceA = typeof a.team.decisions?.price === 'number' ? a.team.decisions.price : 500;
        const priceB = typeof b.team.decisions?.price === 'number' ? b.team.decisions.price : 500;
        if (priceA !== priceB) return priceA - priceB;
        return a.team.name.localeCompare(b.team.name);
      });

    const committedFix = Math.max(0, Number(settings.airlineCapacityFixedCommitted ?? 0));
    const passThroughInitial = Math.max(0, Number(settings.airlineCapacityInitial ?? settings.totalAircraftSeats ?? 1000) - committedFix);
    const airlineRemaining = Math.max(0, Number(settings.airlineCapacityRemaining ?? passThroughInitial));
    let availablePassThrough = airlineRemaining;

    const currentPoolingPrice = Number.isFinite(Number(poolingMarket.currentPrice)) && poolingMarket.currentPrice > 0
      ? poolingMarket.currentPrice
      : Math.max(1, Number(settings.poolingCost ?? 90));

    const newPerTeam = { ...perTeam };
    let totalPoolSold = 0;
    let totalFixSold = 0;
    let totalUnsatisfied = 0;

    for (const { team, idx } of rankedTeams) {
      const demandForTeam = demandInt[idx];
      const id = team.id;
      const state = newPerTeam[id] || {
        fixRemaining: Math.max(0, team.decisions?.fixSeatsAllocated || 0),
        poolRemaining: 0,
        sold: 0,
        poolUsed: 0,
        demand: 0,
        initialFix: Math.max(0, team.decisions?.fixSeatsAllocated || 0),
        initialPool: 0,
        revenue: 0,
        cost: Math.max(0, (team.decisions?.fixSeatsAllocated || 0) * (team.decisions?.fixSeatClearingPrice || settings.fixSeatPrice || 60)),
        insolvent: false
      };

      const fixRemaining = Math.max(0, state.fixRemaining || 0);
      const sellFix = Math.min(demandForTeam, fixRemaining);
      let remainingDemand = demandForTeam - sellFix;

      totalFixSold += sellFix;

      const poolSold = Math.min(remainingDemand, Math.max(0, availablePassThrough));
      availablePassThrough -= poolSold;
      totalPoolSold += poolSold;
      remainingDemand -= poolSold;
      totalUnsatisfied += Math.max(0, remainingDemand);

      const price = typeof team.decisions?.price === 'number' ? team.decisions.price : 500;
      const revenueAdd = (sellFix + poolSold) * price;
      const costAdd = poolSold * currentPoolingPrice;

      const newRevenue = Math.max(0, (state.revenue || 0) + revenueAdd);
      const newCost = Math.max(0, (state.cost || 0) + costAdd);
      const accumulatedDemand = Math.max(0, (state.demand || 0) + demandForTeam);
      const accumulatedSold = Math.max(0, (state.sold || 0) + sellFix + poolSold);
      const accumulatedPool = Math.max(0, (state.poolUsed || 0) + poolSold);
      const initialPool = Math.max(state.initialPool || 0, accumulatedPool);
      const accumulatedFixSold = Math.max(0, (state.fixSold || 0) + sellFix);

      newPerTeam[id] = {
        ...state,
        fixRemaining: Math.max(0, fixRemaining - sellFix),
        poolRemaining: Math.max(0, availablePassThrough),
        sold: accumulatedSold,
        poolUsed: accumulatedPool,
        demand: accumulatedDemand,
        initialFix: state.initialFix ?? Math.max(0, team.decisions?.fixSeatsAllocated || 0),
        initialPool,
        fixSold: accumulatedFixSold,
        revenue: newRevenue,
        cost: newCost,
        insolvent: !!state.insolvent
      };
    }

    const budget = Number(settings.perTeamBudget || 0);
    for (const team of aliveTeams) {
      const st = newPerTeam[team.id];
      if (!st) continue;
      const profitForecast = (st.revenue || 0) - (st.cost || 0);
      if (profitForecast < 0 && Math.abs(profitForecast) > budget) {
        newPerTeam[team.id].insolvent = true;
      }
    }

    const totalPassThroughCapacity = passThroughInitial;
    const totalSeatsOverall = committedFix + totalPassThroughCapacity;
    const soldThisTick = totalPoolSold + totalFixSold;
    const newAirlineRemaining = Math.max(0, availablePassThrough);

    const forecastCurve = Array.isArray(settings.airlineForecastCurve) ? settings.airlineForecastCurve : null;
    let forecastTarget = Number(forecastCurve?.[dayElapsed] ?? NaN);
    if (!Number.isFinite(forecastTarget)) {
      forecastTarget = totalSeatsOverall * progress;
    }

    const cumulativeBefore = Number(settings.airlineSalesCumulative ?? 0);
    const newCumulative = cumulativeBefore + soldThisTick;
    const delta = newCumulative - forecastTarget;

    const currentAirlinePrice = Number.isFinite(Number(poolingMarket.currentPrice)) && poolingMarket.currentPrice > 0
      ? Math.round(poolingMarket.currentPrice)
      : AGENT_V1_DEFAULTS.airline.startPrice;
    const shouldUpdatePrice = nextDays === 0 || nextDays % 7 === 0;

    let newPrice = currentAirlinePrice;
    let priceHistory = Array.isArray(poolingMarket.priceHistory) ? [...poolingMarket.priceHistory] : [];

    if (shouldUpdatePrice || priceHistory.length === 0) {
      const priceMin = Number.isFinite(Number(settings.airlinePriceMin))
        ? Math.max(1, Number(settings.airlinePriceMin))
        : AGENT_V1_DEFAULTS.airline.minPrice;
      const priceMax = Number.isFinite(Number(settings.airlinePriceMax))
        ? Math.max(priceMin + 1, Number(settings.airlinePriceMax))
        : AGENT_V1_DEFAULTS.airline.maxPrice;
      const gamma = Number.isFinite(Number(settings.airlinePriceGamma))
        ? Number(settings.airlinePriceGamma)
        : AGENT_V1_DEFAULTS.airline.gamma;
      const kappa = Number.isFinite(Number(settings.airlinePriceKappa))
        ? Math.max(1, Number(settings.airlinePriceKappa))
        : AGENT_V1_DEFAULTS.airline.kappa;

      let candidatePrice = currentAirlinePrice * (1 + gamma * Math.tanh(delta / Math.max(1, kappa)));
      candidatePrice = Math.max(priceMin, Math.min(priceMax, candidatePrice));
      candidatePrice = Math.round(candidatePrice);
      if (!Number.isFinite(candidatePrice) || candidatePrice <= 0) {
        candidatePrice = Math.max(1, currentAirlinePrice);
      }

      newPrice = candidatePrice;
      priceHistory = [...priceHistory, { price: newPrice, timestamp: new Date().toISOString() }];
      if (priceHistory.length > 90) priceHistory.shift();
    }

    const updatedPoolingMarket = {
      ...poolingMarket,
      currentPrice: newPrice,
      availablePoolingCapacity: newAirlineRemaining,
      totalPoolingCapacity: totalPassThroughCapacity,
      lastUpdate: new Date().toISOString(),
      priceHistory,
      currentDemand: totalDemand,
      soldThisTick,
      unmetDemand: totalUnsatisfied
    };

    const updatedSettings = {
      ...settings,
      poolingMarket: updatedPoolingMarket,
      simulatedDaysUntilDeparture: nextDays,
      simState: { perTeam: newPerTeam, returnedDemandRemaining: 0 },
      airlineCapacityRemaining: newAirlineRemaining,
      airlineSalesCumulative: newCumulative,
      poolingCost: newPrice,
      simRngState: rngState
    };

    await session.update({ settings: updatedSettings });
    session.settings = updatedSettings;

    const phaseCompleted = nextDays <= 0;
    console.log(`🏊 Pooling market updated: €${newPrice} (sold pool: ${soldThisTick}, unmet demand: ${totalUnsatisfied}, ticks left: ${nextDays})`);

    return {
      ...updatedPoolingMarket,
      phaseCompleted,
      ticksRemaining: nextDays,
    };
  }

  // Remove team (when user disconnects)
  static async removeTeam(socketId) {
    const team = await TeamModel.findOne({ where: { socketId } });
    if (team) {
      await team.update({ isActive: false });
      console.log(`Team ${team.name} deactivated due to disconnect`);
    }
  }

  // Reset all game data (admin only)
  static async resetAllData() {
    try {
      // Deactivate all teams
      await TeamModel.update({ isActive: false }, { where: {} });

      // Reset all game sessions
      await GameSessionModel.update({
        currentRound: 0,
        isActive: false,
        settings: {
          baseDemand: 100,
          spread: 50,
          shock: 0.1,
          sharedMarket: true,
          seed: 42,
          roundTime: 300,
          priceElasticity: -1.5,
          crossElasticity: 0.3,
          costVolatility: 0.05,
          demandVolatility: 0.1,
          marketConcentration: 0.7,
          currentPhase: 'prePurchase',
          phaseTime: 600,
          totalCapacity: 1000,
          totalAircraftSeats: 1000,
          totalFixSeats: 500,
          availableFixSeats: 500,
          fixSeatPrice: 60,
          poolingCost: 90,
          simulationMonths: 12,
          departureDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
          fixSeatsAllocated: false, // Reset allocation flag
          poolingReserveCapacity: 300, // 30% of total capacity
          poolingMarketUpdateInterval: 1, // 1 second = 1 day
          simulatedWeeksPerUpdate: 1 // 1 day per update
          ,
          // Hotel defaults
          // Budget
          perTeamBudget: 20000
        }
      }, { where: {} });

      // Delete all round results
      await RoundResultModel.destroy({ where: {} });

      // Delete all high scores
      await HighScoreModel.destroy({ where: {} });

      // Reset current session cache
      this.currentGameSession = null;

      // Create a fresh game session
      const freshSession = await this.getCurrentGameSession();

      console.log('✅ All game data has been reset successfully');
      return {
        success: true,
        message: 'All game data has been reset successfully',
        newSession: freshSession
      };
    } catch (error) {
      console.error('❌ Error resetting game data:', error);
      throw new Error('Failed to reset game data');
    }
  }

  // Reset current game session and teams (keep high scores)
  static async resetCurrentGame() {
    try {
      // Deactivate all current teams (but keep them in database for potential high scores)
      await TeamModel.update({ isActive: false }, { where: { isActive: true } });

      // Reset current game session
      const session = await this.getCurrentGameSession();
      await session.update({
        currentRound: 0,
        isActive: false,
        settings: {
          baseDemand: 100,
          spread: 50,
          shock: 0.1,
          sharedMarket: true,
          seed: 42,
          roundTime: 300,
          priceElasticity: -1.5,
          crossElasticity: 0.3,
          costVolatility: 0.05,
          demandVolatility: 0.1,
          marketConcentration: 0.7,
          currentPhase: 'prePurchase',
          phaseTime: 600,
          totalCapacity: 1000,
          totalAircraftSeats: 1000,
          totalFixSeats: 500,
          availableFixSeats: 500,
          fixSeatPrice: 60,
          poolingCost: 90,
          simulationMonths: 12,
          departureDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
          fixSeatsAllocated: false, // Reset allocation flag
          poolingReserveCapacity: 300, // 30% of total capacity
          poolingMarketUpdateInterval: 1, // 1 second = 1 day
          simulatedWeeksPerUpdate: 1 // 1 day per update
          ,
          // Hotel defaults
          // Budget
          perTeamBudget: 20000
        }
      });

      // Delete round results for current session only
      await RoundResultModel.destroy({ where: { gameSessionId: session.id } });

      // Keep high scores intact - don't delete them

      // Reset current session cache
      this.currentGameSession = null;

      // Create a fresh game session
      const freshSession = await this.getCurrentGameSession();

      console.log('✅ Current game reset successfully (high scores preserved)');
      return {
        success: true,
        message: 'Current game has been reset successfully. High scores are preserved.',
        newSession: freshSession
      };
    } catch (error) {
      console.error('❌ Error resetting current game:', error);
      throw new Error('Failed to reset current game');
    }
  }


}

export default GameService;
