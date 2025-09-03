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
          totalRounds: 5,
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
            availableFixSeats: 500,
            fixSeatPrice: 60,
            simulationMonths: 12,
            departureDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
            poolingMarketUpdateInterval: 1, // 1 second = 1 day
            simulatedWeeksPerUpdate: 1 // 1 day per update
          }
        });
      }

      this.currentGameSession = session;
    }

    return this.currentGameSession;
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
      const existingTeam = await Team.findOne({ where: { name: teamName, isActive: true } });
      if (existingTeam) {
        throw new Error('This team name is already in use. Please choose a different name.');
      }

      const team = await Team.create({
        socketId,
        name: teamName,
        decisions: {
          price: 199,
          buy: { F: 0, P: 0, O: 0 },
          fixSeatsPurchased: 0,
          poolingAllocation: 0
        },
        totalProfit: 0
      });

      return team;
    } catch (error) {
      throw error;
    }
  }

    // Allocate fix seats at end of first round
  static async allocateFixSeats() {
    const session = await this.getCurrentGameSession();
    const teams = await this.getActiveTeams();
    const settings = session.settings || {};

    const totalCapacity = settings.totalCapacity || 1000;
    const poolingReserveRatio = 0.3; // Airline keeps 30% for pooling
    const maxFixCapacity = Math.floor(totalCapacity * (1 - poolingReserveRatio));

    // Collect all requested fix seats
    const requestedSeats = teams.map(team => ({
      teamId: team.id,
      teamName: team.name,
      requested: team.decisions?.fixSeatsPurchased || 0
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
      const requested = team.decisions?.fixSeatsPurchased || 0;
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
    const updatedSettings = { ...currentSettings, ...settings };

    await session.update({ settings: updatedSettings });
    return session;
  }

  // Start pre-purchase phase
  static async startPrePurchasePhase() {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};
    const updatedSettings = { ...currentSettings, currentPhase: 'prePurchase', isActive: true };

    await session.update({ settings: updatedSettings });
    return session;
  }

  // Start simulation phase
  static async startSimulationPhase() {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};
    const updatedSettings = { ...currentSettings, currentPhase: 'simulation', isActive: true };

    await session.update({ settings: updatedSettings });
    return session;
  }

  // End current phase
  static async endPhase() {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};
    const updatedSettings = { ...currentSettings, isActive: false };

    await session.update({ settings: updatedSettings });
    return session;
  }

  // End current round and calculate results
  static async endRound(calculateRoundResults) {
    const session = await this.getCurrentGameSession();
    const teams = await this.getActiveTeams();

    // Calculate round results using the provided function
    const roundResults = calculateRoundResults(teams, session.settings);

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
          capacity: result.capacity
        });

        savedResults.push({
          ...result,
          totalProfit: newTotalProfit
        });
      }
    }

    // Mark session as inactive
    await session.update({ isActive: false });

    return savedResults;
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
      capacity: Object.values(team.decisions?.buy || {}).reduce((sum, cap) => sum + (cap || 0), 0)
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
            fixSeatsAllocated: team.decisions?.fixSeatsAllocated // Show allocated amount if available
          },
          totalProfit: team.totalProfit
        };
      } else {
        // Show full data for own team
        return {
          id: team.id,
          name: team.name,
          decisions: team.decisions,
          totalProfit: team.totalProfit
        };
      }
    });

    return {
      teams: teamsData,
      currentRound: session.currentRound,
      totalRounds: session.totalRounds,
      isActive: session.isActive,
      ...session.settings,
      fares: [
        { code: 'F', label: 'Fix', cost: 60, demandFactor: 1.2 },
        { code: 'P', label: 'ProRata', cost: 85, demandFactor: 1.0 },
        { code: 'O', label: 'Pooling', cost: 110, demandFactor: 0.8 }
      ]
    };
  }

  // Update pooling market prices and availability
  static async updatePoolingMarket() {
    const session = await this.getCurrentGameSession();
    const teams = await this.getActiveTeams();
    const settings = session.settings || {};
    const poolingMarket = settings.poolingMarket || {};

    const totalPoolingCapacity = poolingMarket.totalPoolingCapacity || 300;
    const currentPrice = poolingMarket.currentPrice || 150;

    // Calculate total pooling capacity offered by teams
    const totalPoolingOffered = teams.reduce((sum, team) => {
      const poolingAllocation = (team.decisions?.poolingAllocation || 0) / 100;
      const teamPoolingCapacity = Math.round(settings.totalCapacity * poolingAllocation);
      return sum + teamPoolingCapacity;
    }, 0);

    // Calculate demand pressure (simulated customer demand)
    const baseDemand = settings.baseDemand || 100;
    const demandMultiplier = 0.8 + Math.random() * 0.4; // Random between 0.8 and 1.2
    const currentDemand = Math.round(baseDemand * demandMultiplier);

    // Calculate price adjustment based on supply/demand ratio
    const supplyDemandRatio = totalPoolingOffered / Math.max(1, currentDemand);
    let priceAdjustment = 0;

    if (supplyDemandRatio < 0.8) {
      // High demand, low supply - increase price
      priceAdjustment = Math.min(20, (0.8 - supplyDemandRatio) * 50);
    } else if (supplyDemandRatio > 1.2) {
      // Low demand, high supply - decrease price
      priceAdjustment = Math.max(-20, (supplyDemandRatio - 1.2) * -30);
    }

    // Apply price adjustment with smoothing
    const newPrice = Math.max(80, Math.min(300, currentPrice + priceAdjustment * 0.3));

    // Update price history
    const priceHistory = poolingMarket.priceHistory || [];
    priceHistory.push({
      price: Math.round(newPrice),
      timestamp: new Date().toISOString()
    });

    // Keep only last 20 price points
    if (priceHistory.length > 20) {
      priceHistory.shift();
    }

    // Update market state
    const updatedPoolingMarket = {
      ...poolingMarket,
      currentPrice: Math.round(newPrice),
      availablePoolingCapacity: totalPoolingCapacity,
      offeredPoolingCapacity: totalPoolingOffered,
      currentDemand: currentDemand,
      lastUpdate: new Date().toISOString(),
      priceHistory: priceHistory
    };

    const updatedSettings = {
      ...settings,
      poolingMarket: updatedPoolingMarket
    };

    await session.update({ settings: updatedSettings });

    console.log(`🏊 Pooling market updated: €${Math.round(newPrice)} (offered: ${totalPoolingOffered}/${totalPoolingCapacity}, demand: ${currentDemand}) - ${settings.simulatedWeeksPerUpdate || 2} weeks simulated`);

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
          availableFixSeats: 500,
          fixSeatPrice: 60,
          simulationMonths: 12,
          departureDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
          fixSeatsAllocated: false, // Reset allocation flag
          poolingReserveCapacity: 300, // 30% of total capacity
          poolingMarketUpdateInterval: 1, // 1 second = 1 day
          simulatedWeeksPerUpdate: 1 // 1 day per update
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
          availableFixSeats: 500,
          fixSeatPrice: 60,
          simulationMonths: 12,
          departureDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
          fixSeatsAllocated: false, // Reset allocation flag
          poolingReserveCapacity: 300, // 30% of total capacity
          poolingMarketUpdateInterval: 1, // 1 second = 1 day
          simulatedWeeksPerUpdate: 1 // 1 day per update
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
