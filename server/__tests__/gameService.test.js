import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

// Create ESM-compatible mocks and inject them before importing the module under test
let GameService;
const Team = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn(),
  update: jest.fn()
};
const GameSession = {
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn()
};
const RoundResult = {
  findAll: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn()
};
const HighScore = {
  findAll: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn()
};

beforeAll(async () => {
  jest.resetModules();
  await jest.unstable_mockModule('../database.js', () => ({
    sequelize: { authenticate: jest.fn(), sync: jest.fn() },
    testConnection: jest.fn(),
    default: { authenticate: jest.fn(), sync: jest.fn() }
  }));
  await jest.unstable_mockModule('../models.js', () => ({
    Team,
    GameSession,
    RoundResult,
    HighScore
  }));
  const mod = await import('../gameService.js');
  GameService = mod.GameService;
  if (mod.__setModelsForTesting) {
    mod.__setModelsForTesting({ Team, GameSession, RoundResult, HighScore });
  }
});

describe('GameService', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    // Reset current game session
    GameService.currentGameSession = null;
  });

  describe('getCurrentGameSession', () => {
    test('should return existing active session', async () => {
      const mockSession = {
        id: 1,
        isActive: true,
        currentRound: 0,
        settings: { baseDemand: 100 }
      };

      GameSession.findOne.mockResolvedValue(mockSession);

      const session = await GameService.getCurrentGameSession();

      expect(GameSession.findOne).toHaveBeenCalledWith({
        where: { isActive: true },
        order: [['updatedAt', 'DESC']]
      });
      expect(session).toBe(mockSession);
      expect(GameService.currentGameSession).toBe(mockSession);
    });

    test('should create new session if none exists', async () => {
      const mockNewSession = {
        id: 2,
        isActive: false,
        currentRound: 0,
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
          departureDate: expect.any(Date),
          poolingMarketUpdateInterval: 1,
          simulatedWeeksPerUpdate: 1
        }
      };

      GameSession.findOne.mockResolvedValue(null);
      GameSession.create.mockResolvedValue(mockNewSession);

      const session = await GameService.getCurrentGameSession();

      expect(GameSession.findOne).toHaveBeenCalledWith({
        where: { isActive: true },
        order: [['updatedAt', 'DESC']]
      });
      expect(GameSession.create).toHaveBeenCalled();
      expect(session).toBe(mockNewSession);
      expect(GameService.currentGameSession).toBe(mockNewSession);
    });

    test('should return cached session on subsequent calls', async () => {
      const mockSession = {
        id: 1,
        isActive: true,
        currentRound: 0
      };

      GameSession.findOne.mockResolvedValue(mockSession);

      // First call
      await GameService.getCurrentGameSession();
      // Second call should use cache
      const session = await GameService.getCurrentGameSession();

      expect(GameSession.findOne).toHaveBeenCalledTimes(1);
      expect(session).toBe(mockSession);
    });
  });

  describe('registerTeam', () => {
    test('should create a new team with equal hotel capacity', async () => {
      const mockSession = {
        id: 1,
        settings: {},
        update: jest.fn().mockResolvedValue(undefined)
      };
      const createdTeam = {
        id: 1,
        name: 'Test Team',
        sessionId: 1,
        decisions: {},
        totalProfit: 0,
        update: jest.fn().mockResolvedValue(undefined)
      };

      GameService.currentGameSession = mockSession;
      Team.findAll
        .mockResolvedValueOnce([]) // Before new team joins
        .mockResolvedValueOnce([createdTeam]); // After join for redistribution
      Team.create.mockResolvedValue(createdTeam);

      const team = await GameService.registerTeam('socket123', 'Test Team');

      expect(Team.create).toHaveBeenCalledWith(expect.objectContaining({
        socketId: 'socket123',
        name: 'Test Team',
        decisions: expect.objectContaining({
          price: 199,
          fixSeatsPurchased: 0,
          poolingAllocation: 0,
          hotelCapacity: 600
        }),
        totalProfit: 0
      }));
      expect(mockSession.update).toHaveBeenCalledWith(expect.objectContaining({
        settings: expect.objectContaining({
          hotelCapacityPerTeam: 600
        })
      }));
      expect(createdTeam.update).toHaveBeenCalledWith(expect.objectContaining({
        decisions: expect.objectContaining({ hotelCapacity: 600 })
      }));
      expect(team).toBe(createdTeam);
    });

    test('should throw error if round is in progress', async () => {
      const mockSession = { id: 1, isActive: true };
      GameService.currentGameSession = mockSession;

      await expect(GameService.registerTeam('socket123', 'Test Team')).rejects.toThrow('Cannot join the game while a round is in progress');
    });
  });

  describe('updateTeamDecision (phase restrictions)', () => {
    test('ignores fix seat and pooling changes outside pre-purchase', async () => {
      const mockTeam = {
        decisions: {
          price: 199,
          fixSeatsPurchased: 2,
          fixSeatsRequested: 2,
          poolingAllocation: 25,
          fixSeatBidPrice: 60,
          fixSeatsAllocated: 2,
          hotelCapacity: 100
        },
        update: jest.fn().mockResolvedValue(true)
      };

      Team.findOne.mockResolvedValue(mockTeam);
      GameService.currentGameSession = {
        settings: { currentPhase: 'simulation' }
      };

      await GameService.updateTeamDecision('socket-1', {
        price: 205,
        fixSeatsPurchased: 50,
        poolingAllocation: 80,
        fixSeatBidPrice: 120
      });

      expect(mockTeam.update).toHaveBeenCalledWith({
        decisions: expect.objectContaining({
          price: 205,
          fixSeatsPurchased: 2,
          fixSeatsRequested: 2,
          poolingAllocation: 25,
          fixSeatBidPrice: 60
        })
      });
    });
  });

  describe('getActiveTeams', () => {
    test('should return teams for current session', async () => {
      const mockSession = { id: 1 };
      const mockTeams = [
        { id: 1, name: 'Team 1', sessionId: 1 },
        { id: 2, name: 'Team 2', sessionId: 1 }
      ];

      GameService.currentGameSession = mockSession;
      Team.findAll.mockResolvedValue(mockTeams);

      const teams = await GameService.getActiveTeams();

      expect(Team.findAll).toHaveBeenCalledWith({
        where: { isActive: true },
        include: [{
          model: RoundResult,
          where: { gameSessionId: 1 },
          required: false
        }]
      });
      expect(teams).toBe(mockTeams);
    });

    test('should handle case when no session exists by creating one', async () => {
      const mockSession = { id: 1 };
      const mockTeams = [
        { id: 1, name: 'Team 1', sessionId: 1 },
        { id: 2, name: 'Team 2', sessionId: 1 }
      ];

      GameService.currentGameSession = null;
      GameSession.findOne.mockResolvedValue(null);
      GameSession.create.mockResolvedValue(mockSession);
      Team.findAll.mockResolvedValue(mockTeams);

      const teams = await GameService.getActiveTeams();

      expect(GameSession.findOne).toHaveBeenCalledWith({
        where: { isActive: true },
        order: [['updatedAt', 'DESC']]
      });
      expect(GameSession.create).toHaveBeenCalled();
      expect(teams).toBe(mockTeams);
    });
  });

  describe('removeTeam', () => {
    test('should deactivate team when user disconnects', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        update: jest.fn().mockResolvedValue(true)
      };

      Team.findOne.mockResolvedValue(mockTeam);

      await GameService.removeTeam('socket123');

      expect(Team.findOne).toHaveBeenCalledWith({ where: { socketId: 'socket123' } });
      expect(mockTeam.update).toHaveBeenCalledWith({ isActive: false });
    });

    test('should handle team not found gracefully', async () => {
      Team.findOne.mockResolvedValue(null);

      // Should not throw error
      await expect(GameService.removeTeam('socket123')).resolves.not.toThrow();
    });
  });

  describe('allocateFixSeats (budget cap)', () => {
    test('caps requested fix seats by perTeamBudget in round 0', async () => {
      const session = {
        id: 'sess-1',
        currentRound: 0,
        isActive: false,
        settings: {
          totalAircraftSeats: 100,
          fixSeatPrice: 50,
          perTeamBudget: 120
        },
        update: jest.fn(function (payload) {
          // mimic sequelize update merging settings
          if (payload && payload.settings) this.settings = payload.settings;
          return Promise.resolve(this);
        })
      };
      GameService.currentGameSession = session;

      const t1 = { id: 't1', name: 'Alpha', decisions: { fixSeatsPurchased: 10, fixSeatBidPrice: 50 }, update: jest.fn().mockResolvedValue(true) };
      const t2 = { id: 't2', name: 'Beta', decisions: { fixSeatsPurchased: 10, fixSeatBidPrice: 50 }, update: jest.fn().mockResolvedValue(true) };

      Team.findAll.mockResolvedValue([t1, t2]);

      const res = await GameService.allocateFixSeats();

      // maxByBudget = floor(120/50) = 2 -> allocate exactly 2 if not oversubscribed
      expect(t1.update).toHaveBeenCalledWith({ decisions: expect.objectContaining({
        fixSeatsRequested: 2,
        fixSeatsPurchased: 2,
        fixSeatsAllocated: 2,
        fixSeatBidPrice: 50,
        fixSeatClearingPrice: 50
      }) });
      expect(t2.update).toHaveBeenCalledWith({ decisions: expect.objectContaining({
        fixSeatsRequested: 2,
        fixSeatsPurchased: 2,
        fixSeatsAllocated: 2,
        fixSeatBidPrice: 50,
        fixSeatClearingPrice: 50
      }) });

      // session updated and allocation flagged
      expect(session.update).toHaveBeenCalled();
      expect(session.settings.fixSeatsAllocated).toBe(true);

      // return payload contains allocation info
      const a1 = res.allocations.find(a => a.teamId === 't1');
      const a2 = res.allocations.find(a => a.teamId === 't2');
      expect(a1.allocated).toBe(2);
      expect(a1.bidPrice).toBe(50);
      expect(a1.clearingPrice).toBe(50);
      expect(a2.allocated).toBe(2);
      expect(a2.bidPrice).toBe(50);
      expect(a2.clearingPrice).toBe(50);
    });
  });

  describe('endPhase', () => {
    test('moves from pre-purchase to simulation when phase ends', async () => {
      const session = {
        id: 'sess-end-1',
        currentRound: 0,
        isActive: true,
        settings: { currentPhase: 'prePurchase' },
        update: jest.fn(function (payload) {
          if (payload?.settings) this.settings = payload.settings;
          if (Object.prototype.hasOwnProperty.call(payload || {}, 'isActive')) {
            this.isActive = payload.isActive;
          }
          return Promise.resolve(this);
        })
      };

      GameService.currentGameSession = session;

      const result = await GameService.endPhase();

      expect(session.update).toHaveBeenCalledWith(expect.objectContaining({
        settings: expect.objectContaining({
          currentPhase: 'simulation',
          isActive: false
        }),
        isActive: false
      }));
      expect(result.settings.currentPhase).toBe('simulation');
      expect(result.isActive).toBe(false);
    });

    test('moves from simulation back to pre-purchase when phase ends', async () => {
      const session = {
        id: 'sess-end-2',
        currentRound: 1,
        isActive: true,
        settings: { currentPhase: 'simulation' },
        update: jest.fn(function (payload) {
          if (payload?.settings) this.settings = payload.settings;
          if (Object.prototype.hasOwnProperty.call(payload || {}, 'isActive')) {
            this.isActive = payload.isActive;
          }
          return Promise.resolve(this);
        })
      };

      GameService.currentGameSession = session;

      const result = await GameService.endPhase();

      expect(session.update).toHaveBeenCalledWith(expect.objectContaining({
        settings: expect.objectContaining({
          currentPhase: 'prePurchase',
          isActive: false
        }),
        isActive: false
      }));
      expect(result.settings.currentPhase).toBe('prePurchase');
      expect(result.isActive).toBe(false);
    });
  });

  describe('updatePoolingMarket / endRound (insolvency & returned demand)', () => {
    const realRandom = Math.random;
    beforeEach(() => {
      // deterministic randomness
      Math.random = () => 0.5; // demandMultiplier = 1.0, noise ~ 0
    });
    afterEach(() => {
      Math.random = realRandom;
    });

    test('marks team insolvent early and carries state into endRound', async () => {
      const teamId = 't-insolv';
      const session = {
        id: 'sess-2',
        currentRound: 1,
        isActive: true,
        settings: {
          baseDemand: 5,
          priceElasticity: -1.5,
          totalAircraftSeats: 50,
          fixSeatPrice: 60,
          poolingCost: 90,
          perTeamBudget: 1000,
          hotelBedCost: 500,
          hotelCapacityPerTeam: 100,
          poolingMarket: { currentPrice: 150, totalPoolingCapacity: 15, availablePoolingCapacity: 15, priceHistory: [{ price: 150, timestamp: new Date().toISOString() }], lastUpdate: new Date().toISOString() },
          simulatedWeeksPerUpdate: 1,
          departureDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          simState: {
            returnedDemandRemaining: 0,
            perTeam: {
              [teamId]: {
                fixRemaining: 2,
                poolRemaining: 0,
                sold: 0,
                poolUsed: 0,
                demand: 0,
                initialFix: 2,
                initialPool: 0,
                revenue: 0,
                cost: 2 * 60,
                insolvent: false
              }
            }
          }
        },
        update: jest.fn(function (payload) {
          if (payload && payload.settings) this.settings = payload.settings;
          return Promise.resolve(this);
        })
      };
      GameService.currentGameSession = session;

  const team = { id: teamId, name: 'Gamma', decisions: { price: 100, fixSeatsAllocated: 2, poolingAllocation: 0, hotelCapacity: 100 }, update: jest.fn().mockResolvedValue(true) };
      Team.findAll.mockResolvedValue([team]);

      // Trigger market update: should sell a few seats, then flag insolvency due to huge hotel costs > budget
      await GameService.updatePoolingMarket();

      const poolState = session.settings.poolingMarket || {};
      expect(poolState).toBeDefined();
      expect(poolState.soldThisTick).toBeGreaterThanOrEqual(0);
      expect(poolState.unmetDemand).toBeGreaterThanOrEqual(0);

      // Team state flagged as insolvent
      expect(session.settings.simState.perTeam[teamId].insolvent).toBe(true);

      // Now end round: ensure insolvent flag is persisted
      RoundResult.create.mockResolvedValue({ id: 'rr1' });
      Team.update.mockResolvedValue(true);
      await GameService.endRound(() => []);
      expect(RoundResult.create).toHaveBeenCalledWith(expect.objectContaining({ teamId, insolvent: true }));
    });
  });
});
