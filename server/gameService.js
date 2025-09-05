import { Team, GameSession, RoundResult, HighScore } from './models.js';
import { Op } from 'sequelize';

// Game Service - Handles all game-related database operations
export class GameService {
  static currentGameSession = null;

  // Initialize or get current game session
  static async getCurrentGameSession() {
    if (!this.currentGameSession) {
      // Try to find an active session
      let session = await GameSession.findOne({
        where: { isActive: true },
        order: [['updatedAt', 'DESC']]
      });

      if (!session) {
        // Create new session if none exists
        session = await GameSession.create({
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
            // Hotel defaults
            hotelCapacityRatio: 0.6, // 60% der Flugkapazität als Hotelbetten insgesamt
            hotelBedCost: 50, // Kosten pro leerem Bett
            hotelCapacityAssigned: false,
            // Budget per team (equal for all teams)
            perTeamBudget: 20000
          }
        });
      }

      this.currentGameSession = session;
    }

    return this.currentGameSession;
  }

  // Update a team's decision (price, fix seats intent, pooling allocation, etc.)
  static async updateTeamDecision(socketId, decision = {}) {
    const team = await Team.findOne({ where: { socketId, isActive: true } });
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

    if (typeof decision.fixSeatsPurchased === 'number' && Number.isFinite(decision.fixSeatsPurchased)) {
      // Only intent during pre-purchase; allocation happens separately at phase end
      const requested = Math.max(0, Math.floor(decision.fixSeatsPurchased));
      next.fixSeatsPurchased = requested;
    }

    if (typeof decision.poolingAllocation === 'number' && Number.isFinite(decision.poolingAllocation)) {
      // Percentage 0..100
      const pct = Math.max(0, Math.min(100, Math.round(decision.poolingAllocation)));
      next.poolingAllocation = pct;
    }

    // Preserve hotel capacity and allocated seats fields as they are managed by server phases
    if (team.decisions && typeof team.decisions.hotelCapacity === 'number') {
      next.hotelCapacity = team.decisions.hotelCapacity;
    }
    if (team.decisions && typeof team.decisions.fixSeatsAllocated === 'number') {
      next.fixSeatsAllocated = team.decisions.fixSeatsAllocated;
    }

    await team.update({ decisions: next });
    return team;
  }

  // Get all active teams for current session
  static async getActiveTeams() {
    const session = await this.getCurrentGameSession();
    return await Team.findAll({
      where: { isActive: true },
      include: [{
        model: RoundResult,
        where: { gameSessionId: session.id },
        required: false
      }]
    });
  }

  // Register a new team
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
      const anyTeamWithName = await Team.findOne({ where: { name: normalizedName } });

      if (anyTeamWithName) {
        if (anyTeamWithName.isActive) {
          // Active team with same name -> block with friendly error
          throw new Error('This team name is already in use. Please choose a different name.');
        }

        // Reactivate existing inactive team: reset to a clean state and reuse the row
        const defaultDecisions = {
          price: 199,
          fixSeatsPurchased: 0,
          fixSeatsAllocated: 0,
          poolingAllocation: 0
        };

        // Optionally wipe current-session round results for this team to avoid leftovers
        try {
          const session = await this.getCurrentGameSession();
          await RoundResult.destroy({ where: { teamId: anyTeamWithName.id, gameSessionId: session.id } });
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
          totalProfit: 0
        });

        // After reactivation, update hotel per-team preview if not yet assigned
        try {
          const sess = await this.getCurrentGameSession();
          const teams = await this.getActiveTeams();
          const ratio = (typeof sess.settings?.hotelCapacityRatio === 'number') ? sess.settings.hotelCapacityRatio : 0.6;
          const totalSeats = sess.settings?.totalAircraftSeats || 1000;
          const perTeam = teams.length > 0 ? Math.floor((totalSeats * ratio) / teams.length) : 0;
          const keepAssigned = !!sess.settings?.hotelCapacityAssigned;
          await sess.update({ settings: { ...sess.settings, hotelCapacityPerTeam: perTeam, hotelCapacityAssigned: keepAssigned } });
        } catch (e) {
          console.warn('registerTeam: failed to recompute hotelCapacityPerTeam:', e?.message || e);
        }
        return anyTeamWithName;
      }

    // No existing team with that name -> create fresh
    const perTeamHotel = session.settings?.hotelCapacityAssigned ? (session.settings.hotelCapacityPerTeam || 0) : 0;
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const resumeUntil = new Date(Date.now() + 5 * 60 * 1000);
      const team = await Team.create({
        socketId,
        name: normalizedName,
        resumeToken: token,
        resumeUntil,
        decisions: {
          price: 199,
          fixSeatsPurchased: 0,
      poolingAllocation: 0,
      hotelCapacity: perTeamHotel
        },
        totalProfit: 0
      });

      // After new registration, update hotel per-team preview if not yet assigned
      try {
        const sess = await this.getCurrentGameSession();
        const teams = await this.getActiveTeams();
        const ratio = (typeof sess.settings?.hotelCapacityRatio === 'number') ? sess.settings.hotelCapacityRatio : 0.6;
        const totalSeats = sess.settings?.totalAircraftSeats || 1000;
        const perTeam = teams.length > 0 ? Math.floor((totalSeats * ratio) / teams.length) : 0;
        const keepAssigned = !!sess.settings?.hotelCapacityAssigned;
        await sess.update({ settings: { ...sess.settings, hotelCapacityPerTeam: perTeam, hotelCapacityAssigned: keepAssigned } });
      } catch (e) {
        console.warn('registerTeam: failed to recompute hotelCapacityPerTeam:', e?.message || e);
      }
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
    const team = await Team.findOne({ where: { resumeToken: token } });
    if (!team) return null;
  const resumeUntil = new Date(Date.now() + 5 * 60 * 1000);
  await team.update({ socketId, isActive: true, resumeUntil });
    return team;
  }

  // Explicit logout: prevent resume by clearing token until next registration
  static async logoutTeam(socketId) {
    const team = await Team.findOne({ where: { socketId } });
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

    // Collect all requested fix seats (cap by budget in first round)
    const requestedSeats = teams.map(team => ({
      teamId: team.id,
      teamName: team.name,
      requested: (() => {
        const req = Number(team.decisions?.fixSeatsPurchased || 0);
        // In first round, cannot buy more than budget allows
        if ((session.currentRound || 0) === 0) {
          const budget = Number(settings.perTeamBudget || 0);
          const unit = Number(settings.fixSeatPrice || 60);
          const maxByBudget = unit > 0 ? Math.floor(budget / unit) : req;
          return Math.max(0, Math.min(req, maxByBudget));
        }
        return req;
      })()
    }));

    const totalRequested = requestedSeats.reduce((sum, req) => sum + req.requested, 0);

    let allocationRatio = 1.0;

    // If total requested exceeds available fix capacity, reduce proportionally
    if (totalRequested > maxFixCapacity) {
      allocationRatio = maxFixCapacity / totalRequested;
      console.log(`⚠️ High demand for fix seats. Reducing allocation by ${(1 - allocationRatio) * 100}%`);
    }

    // Allocate seats to teams
    const allocations = [];
    for (const team of teams) {
  const requested = requestedSeats.find(r => r.teamId === team.id)?.requested || 0;
      const allocated = Math.floor(requested * allocationRatio);

      // Update team's actual allocated fix seats
      const updatedDecisions = {
        ...team.decisions,
        fixSeatsPurchased: allocated,
        fixSeatsAllocated: allocated // Store the actually allocated amount
      };

      await team.update({ decisions: updatedDecisions });

      allocations.push({
        teamId: team.id,
        teamName: team.name,
        requested,
        allocated,
        allocationRatio
      });
    }

    // Update session settings to reflect actual allocations
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

    console.log(`✅ Fix seats allocated: ${totalAllocated}/${maxFixCapacity} seats (${Math.round(allocationRatio * 100)}% of requests)`);
    console.log(`🏊 Pooling market initialized with ${totalCapacity - totalAllocated} seats at €${150}`);

    return {
      allocations,
      totalRequested,
      totalAllocated,
      maxFixCapacity,
      allocationRatio,
      poolingReserveCapacity: totalCapacity - totalAllocated
    };
  }

  // Update game settings
  static async updateGameSettings(settings) {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};
    let updatedSettings = { ...currentSettings, ...settings };

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

    // Recompute hotelCapacityPerTeam preview (before assignment) when relevant inputs change
    try {
      if (settings.totalAircraftSeats !== undefined || settings.hotelCapacityRatio !== undefined) {
        const teams = await this.getActiveTeams();
        const ratio = (typeof updatedSettings.hotelCapacityRatio === 'number') ? updatedSettings.hotelCapacityRatio : (typeof currentSettings.hotelCapacityRatio === 'number' ? currentSettings.hotelCapacityRatio : 0.6);
        const totalSeats = updatedSettings.totalAircraftSeats || currentSettings.totalAircraftSeats || 1000;
        const perTeam = teams.length > 0 ? Math.floor((totalSeats * ratio) / teams.length) : 0;
        // Do not flip assigned flag here; keep whatever it currently is
        updatedSettings.hotelCapacityPerTeam = perTeam;
      }
    } catch (e) {
      console.warn('updateGameSettings: failed to recompute hotelCapacityPerTeam:', e?.message || e);
    }

    await session.update({ settings: updatedSettings });
    return session;
  }

  // Start pre-purchase phase
  static async startPrePurchasePhase() {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};
    // Assign equal hotel capacity per team based on totalAircraftSeats and ratio
    const teams = await this.getActiveTeams();
    const ratio = (typeof currentSettings.hotelCapacityRatio === 'number') ? currentSettings.hotelCapacityRatio : 0.6;
    const totalAircraftSeats = currentSettings.totalAircraftSeats || 1000;
    const perTeam = teams.length > 0 ? Math.floor((totalAircraftSeats * ratio) / teams.length) : 0;

    for (const team of teams) {
      const updatedDecisions = {
        ...team.decisions,
        hotelCapacity: perTeam
      };
      await team.update({ decisions: updatedDecisions });
    }

    const updatedSettings = {
      ...currentSettings,
      currentPhase: 'prePurchase',
      isActive: true,
      hotelCapacityAssigned: true,
  hotelCapacityPerTeam: perTeam
    };

    // Set both the top-level session flag and the settings flag for compatibility
    await session.update({ settings: updatedSettings, isActive: true });
    return session;
  }

  // Start simulation phase
  static async startSimulationPhase() {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};
  // Initialize simulated days until departure based on configured departureDate
  const dep = new Date(currentSettings.departureDate || Date.now() + 12 * 30 * 24 * 60 * 60 * 1000);
  const dayMs = 24 * 60 * 60 * 1000;
  const initialDaysRemaining = Math.max(0, Math.ceil((dep.getTime() - Date.now()) / dayMs));
  // Initialize per-team remaining capacities for tick-level matching
  const teams = await this.getActiveTeams();
  const totalSeats = currentSettings.totalAircraftSeats || 1000;
  const perTeamState = {};
  for (const t of teams) {
    const fixRem = Math.max(0, t.decisions?.fixSeatsAllocated || 0);
    const poolRem = Math.max(0, Math.round(totalSeats * ((t.decisions?.poolingAllocation || 0) / 100)));
  const fixCost = fixRem * (currentSettings.fixSeatPrice || 60);
  perTeamState[t.id] = { fixRemaining: fixRem, poolRemaining: poolRem, sold: 0, poolUsed: 0, demand: 0, initialFix: fixRem, initialPool: poolRem, revenue: 0, cost: fixCost, insolvent: false };
  }
  const pmInit = currentSettings.poolingMarket || { currentPrice: 150, totalPoolingCapacity: Math.floor((totalSeats) * 0.3), availablePoolingCapacity: Math.floor((totalSeats) * 0.3), priceHistory: [{ price: 150, timestamp: new Date().toISOString() }], lastUpdate: new Date().toISOString() };
  const updatedPM = { ...pmInit, availablePoolingCapacity: pmInit.totalPoolingCapacity };
  const updatedSettings = { ...currentSettings, currentPhase: 'simulation', isActive: true, simulatedDaysUntilDeparture: initialDaysRemaining, poolingMarket: updatedPM, simState: { perTeam: perTeamState, returnedDemandRemaining: 0 } };

  // Set both the top-level session flag and the settings flag for compatibility
  await session.update({ settings: updatedSettings, isActive: true });
    return session;
  }

  // End current phase
  static async endPhase() {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};
  const updatedSettings = { ...currentSettings, isActive: false };

  // Unset both the top-level session flag and the settings flag for compatibility
  await session.update({ settings: updatedSettings, isActive: false });
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
      // Build results from tick-level accumulations
      const fixSeatPrice = settings.fixSeatPrice || 60;
      const hotelBedCost = settings.hotelBedCost || 50;
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
        const price = team.decisions?.price || 199;
  const passengerRevenue = (st.revenue || (sold * price));
  const fixSeatCost = initialFix * fixSeatPrice; // already included at start as committed cost
  const poolingUsageCost = st.poolUsed ? (poolUsed * avgPoolingUnit) : 0; // safeguard
  const operationalCost = sold * 15;
        const assignedBeds = typeof team.decisions?.hotelCapacity === 'number' ? team.decisions.hotelCapacity : (typeof settings.hotelCapacityPerTeam === 'number' ? settings.hotelCapacityPerTeam : 0);
        const hotelEmptyBeds = Math.max(0, assignedBeds - sold);
        const hotelEmptyBedCost = hotelEmptyBeds * hotelBedCost;
  const totalCost = (st.cost || (fixSeatCost + poolingUsageCost + operationalCost)) + hotelEmptyBedCost;
        const profit = Math.round(passengerRevenue - totalCost);
        const demand = Math.max(0, Math.round(st.demand || 0));
        const unsold = Math.max(0, demand - sold);
  // Insolvency determination at end (if not already flagged)
        const budget = Number(settings.perTeamBudget || 0);
  const flaggedEarly = !!st.insolvent;
  const insolvent = flaggedEarly || ((profit < 0 && Math.abs(profit) > budget) && (session.currentRound || 0) > 0);
        return {
          teamId: team.id,
          sold,
          revenue: Math.round(passengerRevenue),
          cost: Math.round(totalCost),
          profit,
          unsold,
          marketShare: 0, // compute below
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
        await team.update({ totalProfit: newTotalProfit });

        // Save round result
        const roundResult = await RoundResult.create({
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
          totalProfit: newTotalProfit
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
    const roundHistory = await RoundResult.findAll({
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
    const leaderboard = teams.map(team => ({
      name: team.name,
      profit: parseFloat(team.totalProfit || 0),
      marketShare: 0, // Will be calculated if needed
      avgPrice: team.decisions?.price || 199,
      capacity: (team.decisions?.fixSeatsPurchased || 0) + Math.round(((team.decisions?.poolingAllocation || 0) / 100) * 1000)
    })).sort((a, b) => b.profit - a.profit);

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
    return await HighScore.findAll({
      order: [['totalProfit', 'DESC']],
      limit,
      include: [{
        model: GameSession,
        attributes: ['createdAt']
      }]
    });
  }

  // Save high score
  static async saveHighScore(teamName, totalProfit, roundsPlayed, gameSessionId) {
    const avgProfitPerRound = totalProfit / roundsPlayed;

    return await HighScore.create({
      teamName,
      totalProfit,
      roundsPlayed,
      avgProfitPerRound,
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

    const totalPoolingCapacity = poolingMarket.totalPoolingCapacity || 300;
  const currentPrice = poolingMarket.currentPrice || 150;

    // Calculate total pooling capacity offered by teams
    const aliveTeams = teams.filter(t => !(simState.perTeam?.[t.id]?.insolvent));

    const totalPoolingOffered = aliveTeams.reduce((sum, team) => {
      const poolingAllocation = (team.decisions?.poolingAllocation || 0) / 100;
      const teamPoolingCapacity = Math.round((settings.totalAircraftSeats || 1000) * poolingAllocation);
      return sum + teamPoolingCapacity;
    }, 0);

    // Price-sensitive demand allocation across teams (softmax around average price)
    const baseDemand = settings.baseDemand || 100;
    const demandMultiplier = 0.8 + Math.random() * 0.4; // Random between 0.8 and 1.2
    const demandToday = Math.round(baseDemand * demandMultiplier);
  const avgPrice = aliveTeams.length > 0 ? (aliveTeams.reduce((s, t) => s + (t.decisions?.price || 199), 0) / aliveTeams.length) : 199;
    const elasticity = Math.abs(settings.priceElasticity || 1);
    const k = Math.min(0.08, Math.max(0.008, elasticity / 50));
  const weights = aliveTeams.map(t => Math.exp(-k * (((t.decisions?.price || 199) - avgPrice))));
    const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const demandPerTeam = aliveTeams.map((_, i) => Math.max(0, Math.round(demandToday * (weights[i] / sumW))));

  // Add returned demand from bankruptcies (spread across remaining days)
  const stepDaysExtra = Number(settings.simulatedWeeksPerUpdate || 1);
  const extraReturned = Math.min(simState.returnedDemandRemaining || 0, stepDaysExtra > 0 ? Number(simState.returnedDemandRemaining || 0) : 0);
  let returnedLeft = Math.max(0, (simState.returnedDemandRemaining || 0) - extraReturned);
  const extraPerTeam = aliveTeams.length > 0 ? Math.floor(extraReturned / aliveTeams.length) : 0;
  for (let i = 0; i < demandPerTeam.length; i++) demandPerTeam[i] += extraPerTeam;

    // Fix capacities per team (if allocated)
  // Remaining fix/pool per team aus simState; wenn nicht vorhanden, initialisieren konservativ
  const perTeam = simState.perTeam || {};
  const fixPerTeam = aliveTeams.map(t => Math.max(0, (perTeam[t.id]?.fixRemaining ?? t.decisions?.fixSeatsAllocated ?? 0)));
  const poolPerTeam = aliveTeams.map(t => Math.max(0, (perTeam[t.id]?.poolRemaining ?? Math.round((settings.totalAircraftSeats || 1000) * ((t.decisions?.poolingAllocation || 0) / 100)))));

    // Pooling demand = demand beyond each team's fix capacity
  const poolingDemand = demandPerTeam.reduce((s, d, i) => s + Math.max(0, d - fixPerTeam[i]), 0);

    // Price dynamics: supply/demand with mean-reversion towards cost baseline + small noise
  const supplyDemandRatio = totalPoolingOffered / Math.max(1, poolingDemand);
    let priceAdjustment = 0;
    if (supplyDemandRatio < 0.9) {
      priceAdjustment = Math.min(20, (0.9 - supplyDemandRatio) * 40);
    } else if (supplyDemandRatio > 1.1) {
      priceAdjustment = Math.max(-20, (supplyDemandRatio - 1.1) * -30);
    }
    const baseline = (typeof settings.poolingCost === 'number' ? settings.poolingCost : 90) * 1.2;
    const noise = (Math.random() - 0.5) * 2; // -1..1
    const drift = (baseline - currentPrice) * 0.02;
    const rawPrice = currentPrice + priceAdjustment * 0.35 + drift + noise;
    const newPrice = Math.max(80, Math.min(300, rawPrice));

    // Update price history
    const priceHistory = poolingMarket.priceHistory || [];
    priceHistory.push({
      price: Math.round(newPrice),
      timestamp: new Date().toISOString()
    });

  // Keep only last 30 price points
  if (priceHistory.length > 30) {
      priceHistory.shift();
    }

    // Update market state
    // Matching: Fix zuerst konsumieren, dann Pooling; reduziere Restkapazitäten
  const prevAvailable = typeof poolingMarket.availablePoolingCapacity === 'number' ? poolingMarket.availablePoolingCapacity : totalPoolingCapacity;
  let availablePoolingAfter = prevAvailable;
    const newPerTeam = { ...perTeam };
    aliveTeams.forEach((t, i) => {
      const id = t.id;
      const prevFix = Math.max(0, newPerTeam[id]?.fixRemaining ?? fixPerTeam[i]);
      const prevPool = Math.max(0, newPerTeam[id]?.poolRemaining ?? poolPerTeam[i]);
      let need = demandPerTeam[i];
      const useFix = Math.min(need, prevFix);
      const remFix = prevFix - useFix;
      need -= useFix;
      const usePool = Math.min(need, prevPool);
      const remPool = prevPool - usePool;
      need -= usePool;
      availablePoolingAfter = Math.max(0, availablePoolingAfter - usePool);
      const prevSold = Math.max(0, newPerTeam[id]?.sold ?? 0);
      const prevPoolUsed = Math.max(0, newPerTeam[id]?.poolUsed ?? 0);
      const prevDemand = Math.max(0, newPerTeam[id]?.demand ?? 0);
      const prevRevenue = Math.max(0, newPerTeam[id]?.revenue ?? 0);
      const prevCost = Math.max(0, newPerTeam[id]?.cost ?? 0);
      const price = t.decisions?.price || 199;
      const poolingUnit = Math.round((poolingMarket.priceHistory || []).reduce((s, p) => s + (p.price || 0), 0) / Math.max(1, (poolingMarket.priceHistory || []).length)) || (settings.poolingCost || 90);
      const revenueAdd = (useFix + usePool) * price;
      const costAdd = (usePool) * poolingUnit; // pooling cost is pay-per-used
      const newRevenue = prevRevenue + revenueAdd;
      const newCost = prevCost + costAdd;
      newPerTeam[id] = { fixRemaining: remFix, poolRemaining: remPool, sold: prevSold + useFix + usePool, poolUsed: prevPoolUsed + usePool, demand: prevDemand + demandPerTeam[i], initialFix: newPerTeam[id]?.initialFix ?? 0, initialPool: newPerTeam[id]?.initialPool ?? 0, revenue: newRevenue, cost: newCost, insolvent: !!newPerTeam[id]?.insolvent };
    });

    // Early insolvency check per team
    const budget = Number(settings.perTeamBudget || 0);
  const dayMs2 = 24 * 60 * 60 * 1000;
  const dep = new Date(settings.departureDate || Date.now());
  const daysRemaining = Math.max(0, Math.ceil((dep.getTime() - Date.now()) / dayMs2));
    let returnedDemandAccum = returnedLeft; // carry remainder
    for (const t of aliveTeams) {
      const st = newPerTeam[t.id] || {};
      const assignedBeds = typeof t.decisions?.hotelCapacity === 'number' ? t.decisions.hotelCapacity : (typeof settings.hotelCapacityPerTeam === 'number' ? settings.hotelCapacityPerTeam : 0);
      const potentialHotelEmpty = Math.max(0, assignedBeds - (st.sold || 0));
      const hotelEmptyCost = potentialHotelEmpty * (settings.hotelBedCost || 50);
      const totalCostSoFar = (st.cost || 0) + hotelEmptyCost;
      const profitSoFar = (st.revenue || 0) - totalCostSoFar;
      if (profitSoFar < 0 && Math.abs(profitSoFar) > budget) {
        // Team goes bankrupt now
        const soldSoFar = Math.max(0, st.sold || 0);
        newPerTeam[t.id].insolvent = true;
        // Return sold passengers to market over remaining days
        returnedDemandAccum += soldSoFar;
      }
    }

    const updatedPoolingMarket = {
      ...poolingMarket,
  currentPrice: Math.round(newPrice),
  availablePoolingCapacity: availablePoolingAfter,
  offeredPoolingCapacity: newPerTeam ? Object.values(newPerTeam).reduce((s, st) => s + Math.max(0, st.poolRemaining || 0), 0) : totalPoolingOffered,
  currentDemand: poolingDemand,
      lastUpdate: new Date().toISOString(),
      priceHistory: priceHistory
    };

    // Decrease simulated days until departure according to configured step per update
  const dayStep2 = Number(settings.simulatedWeeksPerUpdate || 1); // treated as "days per update"
  const dayMs3 = 24 * 60 * 60 * 1000;
  const computedDaysFromDeparture = (() => {
      try {
        const dep = new Date(settings.departureDate || Date.now());
    return Math.max(0, Math.ceil((dep.getTime() - Date.now()) / dayMs3));
      } catch {
        return 0;
      }
    })();
  const prevDays = Number.isFinite(Number(settings.simulatedDaysUntilDeparture))
      ? Number(settings.simulatedDaysUntilDeparture)
      : computedDaysFromDeparture;
  const nextDays = Math.max(0, prevDays - dayStep2);

    const updatedSettings = {
      ...settings,
      poolingMarket: updatedPoolingMarket,
      simulatedDaysUntilDeparture: nextDays,
      simState: { ...(settings.simState || {}), perTeam: newPerTeam, returnedDemandRemaining: Math.max(0, returnedDemandAccum) }
    };

    await session.update({ settings: updatedSettings });

  console.log(`🏊 Pooling market updated: €${Math.round(newPrice)} (offered: ${totalPoolingOffered}/${totalPoolingCapacity}, poolingDemand: ${poolingDemand}) - ${settings.simulatedWeeksPerUpdate || 2} days simulated`);

    return updatedPoolingMarket;
  }

  // Remove team (when user disconnects)
  static async removeTeam(socketId) {
    const team = await Team.findOne({ where: { socketId } });
    if (team) {
      await team.update({ isActive: false });
      console.log(`Team ${team.name} deactivated due to disconnect`);
    }
  }

  // Reset all game data (admin only)
  static async resetAllData() {
    try {
      // Deactivate all teams
      await Team.update({ isActive: false }, { where: {} });

      // Reset all game sessions
      await GameSession.update({
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
          hotelCapacityRatio: 0.6,
          hotelBedCost: 50,
          hotelCapacityAssigned: false,
          hotelCapacityPerTeam: 0,
          // Budget
          perTeamBudget: 20000
        }
      }, { where: {} });

      // Delete all round results
      await RoundResult.destroy({ where: {} });

      // Delete all high scores
      await HighScore.destroy({ where: {} });

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
      await Team.update({ isActive: false }, { where: { isActive: true } });

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
          hotelCapacityRatio: 0.6,
          hotelBedCost: 50,
          hotelCapacityAssigned: false,
          hotelCapacityPerTeam: 0,
          // Budget
          perTeamBudget: 20000
        }
      });

      // Delete round results for current session only
      await RoundResult.destroy({ where: { gameSessionId: session.id } });

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
