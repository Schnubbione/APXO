const { GameService } = require('../gameService.js');
const { Team, GameSession, RoundResult, HighScore } = require('../models.js');

// Mock the models
jest.mock('../models.js', () => ({
  Team: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
    update: jest.fn()
  },
  GameSession: {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  },
  RoundResult: {
    findAll: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn()
  },
  HighScore: {
    findAll: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn()
  }
}));

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

  describe('createTeam', () => {
    test('should create a new team', async () => {
      const mockSession = { id: 1 };
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        sessionId: 1,
        decisions: {
          price: 199,
          fixSeatsPurchased: 0,
          fixSeatsAllocated: 0,
          poolingAllocation: 0
        },
        totalProfit: 0
      };

      GameService.currentGameSession = mockSession;
      Team.create.mockResolvedValue(mockTeam);

      const team = await GameService.createTeam('Test Team');

      expect(Team.create).toHaveBeenCalledWith({
        name: 'Test Team',
        sessionId: 1,
        decisions: {
          price: 199,
          fixSeatsPurchased: 0,
          fixSeatsAllocated: 0,
          poolingAllocation: 0
        },
        totalProfit: 0
      });
      expect(team).toBe(mockTeam);
    });

    test('should throw error if no current session', async () => {
      GameService.currentGameSession = null;

      await expect(GameService.createTeam('Test Team')).rejects.toThrow('No active game session');
    });
  });

  describe('getTeamsForSession', () => {
    test('should return teams for current session', async () => {
      const mockSession = { id: 1 };
      const mockTeams = [
        { id: 1, name: 'Team 1', sessionId: 1 },
        { id: 2, name: 'Team 2', sessionId: 1 }
      ];

      GameService.currentGameSession = mockSession;
      Team.findAll.mockResolvedValue(mockTeams);

      const teams = await GameService.getTeamsForSession();

      expect(Team.findAll).toHaveBeenCalledWith({
        where: { sessionId: 1 }
      });
      expect(teams).toBe(mockTeams);
    });

    test('should throw error if no current session', async () => {
      GameService.currentGameSession = null;

      await expect(GameService.getTeamsForSession()).rejects.toThrow('No active game session');
    });
  });

  describe('updateTeamDecision', () => {
    test('should update team decision', async () => {
      const mockTeam = {
        id: 1,
        decisions: { price: 199, fixSeatsPurchased: 0, fixSeatsAllocated: 0, poolingAllocation: 0 },
        update: jest.fn().mockResolvedValue(true)
      };

      Team.findOne.mockResolvedValue(mockTeam);

      const decision = { price: 250, fixSeatsPurchased: 10, poolingAllocation: 30 };
      const result = await GameService.updateTeamDecision(1, decision);

      expect(Team.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockTeam.update).toHaveBeenCalledWith({
        decisions: {
          price: 250,
          fixSeatsPurchased: 10,
          poolingAllocation: 30
        }
      });
      expect(result).toBe(true);
    });

    test('should throw error if team not found', async () => {
      Team.findOne.mockResolvedValue(null);

      await expect(GameService.updateTeamDecision(1, { price: 250 })).rejects.toThrow('Team not found');
    });
  });
});
