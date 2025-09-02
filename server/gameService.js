import { Team, GameSession, RoundResult, HighScore } from './models.js';

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
            marketConcentration: 0.7
          }
        });
      }

      this.currentGameSession = session;
    }

    return this.currentGameSession;
  }

  // Get current game state for broadcasting
  static async getCurrentGameState() {
    const session = await this.getCurrentGameSession();
    const activeTeams = await this.getActiveTeams();

    return {
      teams: activeTeams.map(team => ({
        id: team.id,
        name: team.name,
        decisions: team.decisions,
        totalProfit: team.totalProfit
      })),
      currentRound: session.currentRound,
      totalRounds: session.totalRounds,
      isActive: session.isActive,
      adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
      ...session.settings,
      fares: [
        { code: 'F', label: 'Fix', cost: 60, demandFactor: 1.2 },
        { code: 'P', label: 'ProRata', cost: 85, demandFactor: 1.0 },
        { code: 'O', label: 'Pooling', cost: 110, demandFactor: 0.8 }
      ]
    };
  }

  // Register a new team
  static async registerTeam(socketId, teamName) {
    try {
      const existingTeam = await Team.findOne({ where: { name: teamName, isActive: true } });
      if (existingTeam) {
        throw new Error('Team name already taken');
      }

      const team = await Team.create({
        socketId,
        name: teamName,
        decisions: {
          price: 199,
          buy: { F: 0, P: 0, O: 0 }
        },
        totalProfit: 0
      });

      return team;
    } catch (error) {
      throw error;
    }
  }

  // Remove team (when disconnecting)
  static async removeTeam(socketId) {
    const team = await Team.findOne({ where: { socketId, isActive: true } });
    if (team) {
      await team.update({ isActive: false });
      return team;
    }
    return null;
  }

  // Update game settings
  static async updateGameSettings(settings) {
    const session = await this.getCurrentGameSession();
    const currentSettings = session.settings || {};
    const updatedSettings = { ...currentSettings, ...settings };

    await session.update({ settings: updatedSettings });
    return session;
  }

  // Start new round
  static async startRound() {
    const session = await this.getCurrentGameSession();
    const newRound = session.currentRound + 1;

    await session.update({
      currentRound: newRound,
      isActive: true
    });

    return newRound;
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

  // Clean up inactive teams (called periodically)
  static async cleanupInactiveTeams() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await Team.update(
      { isActive: false },
      {
        where: {
          updatedAt: { [Op.lt]: oneHourAgo },
          isActive: true
        }
      }
    );
  }

  // Reset game session
  static async resetGameSession() {
    const session = await this.getCurrentGameSession();
    await session.update({
      currentRound: 0,
      isActive: false
    });

    // Mark all teams as inactive
    await Team.update({ isActive: false }, { where: { isActive: true } });

    this.currentGameSession = null;
    return await this.getCurrentGameSession();
  }
}

export default GameService;
