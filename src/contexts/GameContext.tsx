import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Team {
  id: string;
  name: string;
  decisions: {
    price: number;
    buy: Record<string, number>;
  };
  totalProfit: number;
}

interface Fare {
  code: string;
  label: string;
  cost: number;
}

interface GameState {
  teams: Team[];
  currentRound: number;
  totalRounds: number;
  isActive: boolean;
  baseDemand: number;
  spread: number;
  shock: number;
  sharedMarket: boolean;
  seed: number;
  roundTime: number;
  fares: Fare[];
}

interface RoundResult {
  teamId: string;
  sold: number;
  revenue: number;
  cost: number;
  profit: number;
  unsold: number;
}

interface GameContextType {
  socket: Socket | null;
  gameState: GameState;
  currentTeam: Team | null;
  isAdmin: boolean;
  roundResults: RoundResult[] | null;
  leaderboard: Array<{ name: string; profit: number }> | null;
  roundHistory: any[];
  analyticsData: any;

  // Actions
  registerTeam: (name: string) => void;
  loginAsAdmin: (password: string) => void;
  updateGameSettings: (settings: Partial<GameState>) => void;
  updateTeamDecision: (decision: { price?: number; buy?: Record<string, number> }) => void;
  startRound: () => void;
  endRound: () => void;
  getLeaderboard: () => void;
  getAnalytics: () => void;
  resetAllData: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    teams: [],
    currentRound: 0,
    totalRounds: 5,
    isActive: false,
    baseDemand: 100,
    spread: 50,
    shock: 0.1,
    sharedMarket: true,
    seed: 42,
    roundTime: 300,
    fares: [
      { code: 'F', label: 'Fix', cost: 60 },
      { code: 'P', label: 'ProRata', cost: 85 },
      { code: 'O', label: 'Pooling', cost: 110 }
    ]
  });
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roundResults, setRoundResults] = useState<RoundResult[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{ name: string; profit: number }> | null>(null);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  useEffect(() => {
    // Use environment variable for server URL, fallback to localhost for development
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    console.log('Connecting to server:', serverUrl);

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Listen for game state updates
    newSocket.on('gameState', (state: GameState) => {
      console.log('Game state updated:', state);
      // Ensure each team has all fare codes initialized
      const allCodes = (state.fares || []).map(f => f.code);
      const normalizedTeams = (state.teams || []).map(t => ({
        ...t,
        decisions: {
          price: t.decisions?.price ?? 199,
          buy: allCodes.reduce((acc, code) => ({ ...acc, [code]: t.decisions?.buy?.[code] ?? 0 }), {} as Record<string, number>)
        }
      }));
      setGameState({ ...state, teams: normalizedTeams });
      // Keep currentTeam in sync with backend state (by socket id)
  const myTeam = normalizedTeams.find(t => t.id === newSocket.id);
      if (myTeam) {
        setCurrentTeam(myTeam);
      }
    });

    // Listen for registration success
    newSocket.on('registrationSuccess', (team: Team) => {
      console.log('Team registered:', team);
      setCurrentTeam(team);
    });

    // Listen for admin login
    newSocket.on('adminLoginSuccess', () => {
      console.log('Admin login successful');
      setIsAdmin(true);
    });

    // Listen for admin login error
    newSocket.on('adminLoginError', (error: string) => {
      console.error('Admin login error:', error);
      // Could emit an event or set an error state here
    });

    // Listen for round events
    newSocket.on('roundStarted', (roundNumber: number) => {
      setGameState(prev => ({ ...prev, currentRound: roundNumber, isActive: true }));
      setRoundResults(null);
    });

    newSocket.on('roundEnded', (data: { roundResults: RoundResult[], roundNumber: number }) => {
      setRoundResults(data.roundResults);
      setGameState(prev => ({ ...prev, isActive: false }));
    });

    // Listen for leaderboard
    newSocket.on('leaderboard', (board: Array<{ name: string; profit: number }>) => {
      setLeaderboard(board);
    });

    // Listen for analytics data
    newSocket.on('analyticsData', (data: any) => {
      setRoundHistory(data.roundHistory || []);
      setAnalyticsData(data);
    });

    // Listen for reset confirmation
    newSocket.on('resetAllDataSuccess', () => {
      console.log('All data reset successfully');
      // Reset local state
      setGameState(prev => ({
        ...prev,
        teams: [],
        currentRound: 0,
        isActive: false
      }));
      setCurrentTeam(null);
      setRoundResults(null);
      setLeaderboard(null);
      setRoundHistory([]);
      setAnalyticsData(null);
    });

    newSocket.on('resetAllDataError', (error: string) => {
      console.error('Reset all data error:', error);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const registerTeam = (name: string) => {
    socket?.emit('registerTeam', name);
  };

  const loginAsAdmin = (password: string) => {
    socket?.emit('adminLogin', password);
  };

  const updateGameSettings = (settings: Partial<GameState>) => {
    socket?.emit('updateGameSettings', settings);
  };

  const updateTeamDecision = (decision: { price?: number; buy?: Record<string, number> }) => {
    // Optimistic local update for snappy UI
    setCurrentTeam(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        decisions: {
          ...prev.decisions,
          ...(decision.price !== undefined ? { price: decision.price } : {}),
          ...(decision.buy ? { buy: { ...prev.decisions.buy, ...decision.buy } } : {})
        }
      };
    });

    // Also reflect in global game state teams for local view until server confirms
    setGameState(prev => {
      const sid = socket?.id;
      if (!sid) return prev;
      return {
        ...prev,
        teams: prev.teams.map(t => t.id === sid ? {
          ...t,
          decisions: {
            ...t.decisions,
            ...(decision.price !== undefined ? { price: decision.price } : {}),
            ...(decision.buy ? { buy: { ...t.decisions.buy, ...decision.buy } } : {})
          }
        } : t)
      };
    });

    // Notify server
    socket?.emit('updateTeamDecision', decision);
  };

  const startRound = () => {
    socket?.emit('startRound');
  };

  const endRound = () => {
    socket?.emit('endRound');
  };

  const getLeaderboard = () => {
    socket?.emit('getLeaderboard');
  };

  const getAnalytics = () => {
    socket?.emit('getAnalytics');
  };

  const resetAllData = () => {
    socket?.emit('resetAllData');
  };

  const value: GameContextType = {
    socket,
    gameState,
    currentTeam,
    isAdmin,
    roundResults,
    leaderboard,
    roundHistory,
    analyticsData,
    registerTeam,
    loginAsAdmin,
    updateGameSettings,
    updateTeamDecision,
    startRound,
    endRound,
    getLeaderboard,
    getAnalytics,
    resetAllData
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};
