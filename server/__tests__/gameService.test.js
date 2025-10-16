import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

// Create ESM-compatible mocks and inject them before importing the module under test
let GameService;
const Team = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn(),
  update: jest.fn(),
  count: jest.fn()
};
const GameSession = {
  findOne: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  count: jest.fn()
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
    GameService.sessionCache = new Map();
    Team.count.mockResolvedValue(0);
    Team.findAll.mockResolvedValue([]);
    Team.findOne.mockResolvedValue(null);
    Team.destroy.mockResolvedValue(0);
    RoundResult.destroy.mockResolvedValue(0);
    HighScore.destroy.mockResolvedValue(0);
    GameSession.count.mockResolvedValue(0);
    GameSession.findAll.mockResolvedValue([]);
    GameSession.findOne.mockResolvedValue(null);
    GameSession.destroy.mockResolvedValue(0);
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
          roundTime: 60,
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
          simulatedWeeksPerUpdate: 7
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
    test('should create a new team with default decisions', async () => {
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
        totalRevenue: 0,
        update: jest.fn().mockResolvedValue(undefined)
      };

      GameService.currentGameSession = mockSession;
      GameService.sessionCache.set(mockSession.id, mockSession);
      GameSession.findByPk.mockResolvedValue(mockSession);
      Team.findOne.mockResolvedValue(null);
      Team.findAll.mockResolvedValue([]);
      Team.create.mockResolvedValue(createdTeam);

      const team = await GameService.registerTeam('socket123', 'Test Team', mockSession.id);

      expect(Team.create).toHaveBeenCalledWith(expect.objectContaining({
        socketId: 'socket123',
        name: 'Test Team',
        decisions: expect.objectContaining({
          price: 500,
          fixSeatsPurchased: 0,
          poolingAllocation: 0
        }),
        lastActiveAt: expect.any(Date),
        totalProfit: 0,
        totalRevenue: 0
      }));
      expect(team).toBe(createdTeam);
    });

    test('should throw error if round is in progress', async () => {
      const mockSession = { id: 1, isActive: true, update: jest.fn() };
      GameService.currentGameSession = mockSession;
      GameService.sessionCache.set(mockSession.id, mockSession);
      GameSession.findByPk.mockResolvedValue(mockSession);

      await expect(GameService.registerTeam('socket123', 'Test Team', mockSession.id)).rejects.toThrow('Cannot join the game while a round is in progress');
    });

    test('reattaches a disconnected active team without resetting state', async () => {
      const mockSession = {
        id: 1,
        isActive: false,
        settings: {},
        ownerTeamId: 'team-1',
        update: jest.fn().mockResolvedValue(undefined)
      };
      const existingTeam = {
        id: 'team-1',
        name: 'Admin Team',
        gameSessionId: 1,
        isActive: true,
        socketId: null,
        decisions: { price: 450 },
        totalProfit: 1234,
        totalRevenue: 5678,
        update: jest.fn().mockResolvedValue(undefined)
      };

      GameService.currentGameSession = mockSession;
      GameService.sessionCache.set(mockSession.id, mockSession);
      GameSession.findByPk.mockResolvedValue(mockSession);
      Team.findOne.mockResolvedValue(existingTeam);
      Team.findAll.mockResolvedValue([existingTeam]);

      const updateFixSpy = jest.spyOn(GameService, 'updateFixSeatShare').mockResolvedValue({});

      const team = await GameService.registerTeam('socket123', 'Admin Team', mockSession.id);

      expect(existingTeam.update).toHaveBeenCalledTimes(1);
      const updatePayload = existingTeam.update.mock.calls[0][0];
      expect(updatePayload).toMatchObject({
        socketId: 'socket123',
        isActive: true,
        resumeToken: expect.any(String),
        resumeUntil: expect.any(Date),
        gameSessionId: 1
      });
      // Existing metrics and decisions should remain untouched during reattach
      expect(updatePayload).not.toHaveProperty('decisions');
      expect(updatePayload).not.toHaveProperty('totalProfit');
      expect(updatePayload).not.toHaveProperty('totalRevenue');
      expect(team).toBe(existingTeam);
      updateFixSpy.mockRestore();
    });

    test('requires a session identifier', async () => {
      await expect(GameService.registerTeam('socket123', 'Admin Team')).rejects.toThrow(
        'Please select a session before joining.'
      );
    });
  });

  describe('updateTeamDecision (phase restrictions)', () => {
    test('ignores fix seat and pooling changes outside pre-purchase', async () => {
      const mockTeam = {
        decisions: {
          price: 500,
          fixSeatsPurchased: 2,
          fixSeatsRequested: 2,
          poolingAllocation: 25,
          fixSeatBidPrice: 60,
          fixSeatsAllocated: 2
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

      expect(mockTeam.update).toHaveBeenCalledWith(expect.objectContaining({
        decisions: expect.objectContaining({
          price: 205,
          fixSeatsPurchased: 2,
          fixSeatsRequested: 2,
          poolingAllocation: 25,
          fixSeatBidPrice: 60
        }),
        lastActiveAt: expect.any(Date)
      }));
    });
  });

  describe('getActiveTeams', () => {
    test('should return teams for current session', async () => {
      const mockSession = { id: 1, settings: {}, update: jest.fn().mockResolvedValue(undefined) };
      const mockTeams = [
        { id: 1, name: 'Team 1', sessionId: 1 },
        { id: 2, name: 'Team 2', sessionId: 1 }
      ];

      GameService.currentGameSession = mockSession;
      Team.findAll.mockResolvedValue(mockTeams);

      const teams = await GameService.getActiveTeams();

      expect(Team.findAll).toHaveBeenCalledWith({
        where: { isActive: true, gameSessionId: 1 },
        include: [{
          model: RoundResult,
          where: { gameSessionId: 1 },
          required: false
        }]
      });
      expect(teams).toEqual(mockTeams);
    });

    test('should handle case when no session exists by creating one', async () => {
      const mockSession = { id: 1, settings: {}, update: jest.fn().mockResolvedValue(undefined) };
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
      expect(teams).toEqual(mockTeams);
    });
  });

  describe('removeTeam', () => {
    test('should deactivate team when user disconnects', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        gameSessionId: 1,
        update: jest.fn().mockResolvedValue(true)
      };

      Team.findOne.mockResolvedValue(mockTeam);
      const mockSession = { id: 1, settings: {}, update: jest.fn().mockResolvedValue(undefined) };
      GameService.currentGameSession = mockSession;
      GameService.sessionCache.set(1, mockSession);
      GameSession.findByPk.mockResolvedValue(mockSession);
      Team.findAll.mockResolvedValue([]);
      const updateFixSpy = jest.spyOn(GameService, 'updateFixSeatShare').mockResolvedValue({});

      await GameService.removeTeam('socket123');

      expect(Team.findOne).toHaveBeenCalledWith({ where: { socketId: 'socket123' } });
      expect(mockTeam.update).toHaveBeenCalledWith({
        isActive: false,
        socketId: null,
        resumeToken: null,
        resumeUntil: null,
        lastActiveAt: null
      });
      updateFixSpy.mockRestore();
    });

    test('should handle team not found gracefully', async () => {
      Team.findOne.mockResolvedValue(null);

      // Should not throw error
      await expect(GameService.removeTeam('socket123')).resolves.not.toThrow();
    });
  });

  describe('deactivateInactiveTeams', () => {
    test('logs out teams that exceeded inactivity threshold', async () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const staleTeam = { id: 'team-1', name: 'Stale', socketId: 'socket-1', gameSessionId: 'session-1' };

      Team.findAll
        .mockResolvedValueOnce([staleTeam])
        .mockResolvedValueOnce([])
        .mockResolvedValue([]);
      Team.update.mockResolvedValue([1]);

      const session = { id: 'session-1', settings: {}, update: jest.fn().mockResolvedValue(undefined) };
      GameService.currentGameSession = session;
      GameService.sessionCache.set(session.id, session);
      GameSession.findByPk.mockResolvedValue(session);

      const updateFixSpy = jest.spyOn(GameService, 'updateFixSeatShare').mockResolvedValue({});

      const result = await GameService.deactivateInactiveTeams({ now });

      expect(result.deactivated).toEqual([{ id: 'team-1', name: 'Stale', socketId: 'socket-1', gameSessionId: 'session-1' }]);
      expect(Team.update).toHaveBeenCalledWith({
        isActive: false,
        socketId: null,
        resumeToken: null,
        resumeUntil: null,
        lastActiveAt: null
      }, { where: { id: ['team-1'] } });
      expect(updateFixSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'session-1' }), { teamCount: 0, resetAvailable: true });

      updateFixSpy.mockRestore();
    });

    test('returns empty result when no teams are inactive', async () => {
      Team.findAll.mockResolvedValueOnce([]).mockResolvedValue([]);

      const result = await GameService.deactivateInactiveTeams();

      expect(result.deactivated).toEqual([]);
      expect(Team.update).not.toHaveBeenCalled();
    });
  });

  describe('removeInactiveSessions', () => {
    test('removes inactive sessions without active teams', async () => {
      const staleSession = {
        id: 'sess-1',
        name: 'Old Session',
        slug: 'old-session',
        isActive: false,
        destroy: jest.fn().mockResolvedValue(undefined)
      };

      GameSession.findAll.mockResolvedValue([staleSession]);
      Team.count
        .mockResolvedValueOnce(0) // active teams
        .mockResolvedValueOnce(0); // total teams
      Team.destroy.mockResolvedValue(1);
      RoundResult.destroy.mockResolvedValue(1);
      HighScore.destroy.mockResolvedValue(1);

      GameService.currentGameSession = { id: 'keep-session' };

      const result = await GameService.removeInactiveSessions({ now: new Date() });

      expect(staleSession.destroy).toHaveBeenCalled();
      expect(Team.destroy).toHaveBeenCalledWith({ where: { gameSessionId: 'sess-1' } });
      expect(result.removed).toEqual([{ id: 'sess-1', name: 'Old Session', teamCount: 0 }]);
    });

    test('keeps admin session intact', async () => {
      const adminSession = {
        id: 'admin-session-id',
        name: 'Admin Session',
        slug: 'admin-session',
        isActive: false,
        destroy: jest.fn().mockResolvedValue(undefined)
      };

      GameSession.findAll.mockResolvedValue([adminSession]);

      const result = await GameService.removeInactiveSessions({ now: new Date() });

      expect(adminSession.destroy).not.toHaveBeenCalled();
      expect(result.removed).toEqual([]);
    });

    test('keeps legacy default session intact', async () => {
      const legacySession = {
        id: 'legacy-session-id',
        name: 'Default Session',
        slug: 'default-session',
        isActive: false,
        destroy: jest.fn().mockResolvedValue(undefined)
      };

      GameSession.findAll.mockResolvedValue([legacySession]);

      const result = await GameService.removeInactiveSessions({ now: new Date() });

      expect(legacySession.destroy).not.toHaveBeenCalled();
      expect(result.removed).toEqual([]);
    });
  });

  describe('deleteAllSessions', () => {
    test('destroys session data and creates fresh session', async () => {
      Team.destroy.mockResolvedValue(1);
      RoundResult.destroy.mockResolvedValue(1);
      HighScore.destroy.mockResolvedValue(1);
      GameSession.destroy.mockResolvedValue(1);

      const freshSession = { id: 'fresh', settings: {}, update: jest.fn().mockResolvedValue(undefined) };
      const getSessionSpy = jest.spyOn(GameService, 'getCurrentGameSession').mockResolvedValueOnce(freshSession);
      const updateFixSpy = jest.spyOn(GameService, 'updateFixSeatShare').mockResolvedValueOnce({});

      const result = await GameService.deleteAllSessions();

      expect(Team.destroy).toHaveBeenCalledWith({ where: {} });
      expect(GameSession.destroy).toHaveBeenCalledWith({ where: {} });
      expect(getSessionSpy).toHaveBeenCalled();
      expect(updateFixSpy).toHaveBeenCalledWith(freshSession, { teamCount: 0, resetAvailable: true });
      expect(result).toEqual({ success: true, session: freshSession });

      getSessionSpy.mockRestore();
      updateFixSpy.mockRestore();
    });
  });

  describe('createSession', () => {
    test('throws when session with name already exists', async () => {
      GameSession.findOne.mockImplementation(({ where } = {}) => {
        if (where?.name === 'Duplicate Name') {
          return Promise.resolve({ id: 'existing-session' });
        }
        return Promise.resolve(null);
      });
      GameSession.findAll.mockResolvedValue([]);

      await expect(GameService.createSession({ name: 'Duplicate Name' })).rejects.toThrow('A session with this name already exists.');
    });

    test('reserves admin session name', async () => {
      GameSession.findAll.mockResolvedValue([]);

      await expect(GameService.createSession({ name: 'Admin Session' })).rejects.toThrow('This name is reserved for the admin session.');
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
          fixSeatMinBid: 50,
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
        fixSeatsRequested: 10,
        fixSeatsPurchased: 2,
        fixSeatsAllocated: 2,
        fixSeatBidPrice: 50,
        fixSeatClearingPrice: 50
      }) });
      expect(t2.update).toHaveBeenCalledWith({ decisions: expect.objectContaining({
        fixSeatsRequested: 10,
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
      expect(a1.requestedOriginal).toBe(10);
      expect(a2.allocated).toBe(2);
      expect(a2.bidPrice).toBe(50);
      expect(a2.clearingPrice).toBe(50);
      expect(a2.requestedOriginal).toBe(10);
    });

    test('ignores bids below the minimum airline threshold', async () => {
      const session = {
        id: 'sess-2',
        currentRound: 0,
        isActive: false,
        settings: {
          totalAircraftSeats: 100,
          fixSeatPrice: 60,
          fixSeatMinBid: 90,
          perTeamBudget: 1000
        },
        update: jest.fn(function (payload) {
          if (payload && payload.settings) this.settings = payload.settings;
          return Promise.resolve(this);
        })
      };
      GameService.currentGameSession = session;

      const lowBidTeam = {
        id: 'low',
        name: 'LowBid',
        decisions: { fixSeatsPurchased: 10, fixSeatBidPrice: 80 },
        update: jest.fn().mockResolvedValue(true)
      };
      const highBidTeam = {
        id: 'high',
        name: 'HighBid',
        decisions: { fixSeatsPurchased: 10, fixSeatBidPrice: 120 },
        update: jest.fn().mockResolvedValue(true)
      };

      Team.findAll.mockResolvedValue([lowBidTeam, highBidTeam]);

      const res = await GameService.allocateFixSeats();

      expect(lowBidTeam.update).toHaveBeenCalledWith({ decisions: expect.objectContaining({
        fixSeatsRequested: 10,
        fixSeatsPurchased: 0,
        fixSeatsAllocated: 0,
        fixSeatBidPrice: 80,
        fixSeatClearingPrice: null
      }) });
      expect(highBidTeam.update).toHaveBeenCalledWith({ decisions: expect.objectContaining({
        fixSeatsRequested: 10,
        fixSeatsPurchased: expect.any(Number),
        fixSeatsAllocated: expect.any(Number),
        fixSeatBidPrice: 120,
        fixSeatClearingPrice: expect.any(Number)
      }) });

      const lowSummary = res.allocations.find(a => a.teamId === 'low');
      const highSummary = res.allocations.find(a => a.teamId === 'high');

      expect(lowSummary.allocated).toBe(0);
      expect(lowSummary.disqualifiedForLowBid).toBe(true);
      expect(lowSummary.minRequiredBid).toBe(90);

      expect(highSummary.allocated).toBeGreaterThan(0);
      expect(highSummary.disqualifiedForLowBid).toBe(false);

      expect(res.minimumBidPrice).toBe(90);
      expect(session.settings.fixSeatsAllocated).toBe(true);
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
          perTeamBudget: 50,
          poolingMarket: { currentPrice: 150, totalPoolingCapacity: 15, availablePoolingCapacity: 15, priceHistory: [{ price: 150, timestamp: new Date().toISOString() }], lastUpdate: new Date().toISOString() },
          simulatedWeeksPerUpdate: 7,
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
                cost: 120,
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

  const team = { id: teamId, name: 'Gamma', decisions: { price: 100, fixSeatsAllocated: 2, poolingAllocation: 0 }, update: jest.fn().mockResolvedValue(true) };
      Team.findAll.mockResolvedValue([team]);

      // Trigger market update: should sell a few seats, then flag insolvency because losses exceed the budget
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
