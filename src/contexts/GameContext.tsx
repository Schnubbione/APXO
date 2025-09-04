import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Team {
  id: string;
  name: string;
  decisions: {
    price: number;
    buy: Record<string, number>;
    fixSeatsPurchased: number;
    fixSeatsAllocated?: number; // Actually allocated fix seats (may be less than purchased)
    poolingAllocation: number;
  hotelCapacity?: number;
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
  currentPhase: 'prePurchase' | 'simulation';
  phaseTime: number;
  totalCapacity: number;
  totalFixSeats: number;
  availableFixSeats: number;
  fixSeatPrice: number;
  simulationMonths: number;
  departureDate: Date;
  fixSeatsAllocated?: boolean;
  poolingReserveCapacity?: number;
  poolingMarketUpdateInterval?: number; // in seconds
  simulatedWeeksPerUpdate?: number; // weeks simulated per market update
  poolingMarket?: {
    currentPrice: number;
    totalPoolingCapacity: number;
    availablePoolingCapacity: number;
    offeredPoolingCapacity: number;
    currentDemand: number;
    lastUpdate: string;
    priceHistory: Array<{ price: number; timestamp: string }>;
  };
  // Hotel info
  hotelBedCost?: number;
  hotelCapacityAssigned?: boolean;
  hotelCapacityPerTeam?: number;
  // Round timer
  remainingTime?: number;
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
  // Practice mode state
  practice:
    | { running: true; rounds: number; aiCount: number }
    | { running: false; results?: any }
    | null;
  leaderboard: Array<{ name: string; profit: number }> | null;
  roundHistory: any[];
  analyticsData: any;
  registrationError: string | null;
  adminLoginError: string | null;

  // Tutorial state
  tutorialActive: boolean;
  tutorialStep: number;
  startTutorial: () => void;
  skipTutorial: () => void;
  nextTutorialStep: () => void;
  previousTutorialStep: () => void;
  setTutorialStep: (step: number) => void;
  completeTutorial: () => void;

  // Actions
  registerTeam: (name: string) => void;
  loginAsAdmin: (password: string) => void;
  logoutAsAdmin: () => void;
  updateGameSettings: (settings: Partial<GameState>) => void;
  updateTeamDecision: (decision: { price?: number; buy?: Record<string, number>; fixSeatsPurchased?: number; poolingAllocation?: number }) => void;
  startPracticeMode: (config?: { rounds?: number; aiCount?: number; overridePrice?: number }) => void;
  startPrePurchasePhase: () => void;
  startSimulationPhase: () => void;
  endRound: () => void;
  getLeaderboard: () => void;
  getAnalytics: () => void;
  resetAllData: () => void;
  resetCurrentGame: () => void;
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
    ],
    currentPhase: 'prePurchase',
    phaseTime: 600, // 10 minutes for pre-purchase phase
    totalCapacity: 1000,
    totalFixSeats: 500,
    availableFixSeats: 500,
    fixSeatPrice: 60,
    simulationMonths: 12,
    departureDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000), // 12 months from now
    fixSeatsAllocated: false,
    poolingReserveCapacity: 300,
    poolingMarketUpdateInterval: 1, // 1 second = 1 day
    simulatedWeeksPerUpdate: 1, // 1 day per update
    poolingMarket: {
      currentPrice: 150,
      totalPoolingCapacity: 300,
      availablePoolingCapacity: 300,
      offeredPoolingCapacity: 0,
      currentDemand: 100,
      lastUpdate: new Date().toISOString(),
      priceHistory: [{ price: 150, timestamp: new Date().toISOString() }]
  },
  // Hotel defaults in initial state (will be overwritten by server)
  hotelBedCost: 50,
  hotelCapacityAssigned: false,
  hotelCapacityPerTeam: 0,
  // Round timer
  remainingTime: 0
  });
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roundResults, setRoundResults] = useState<RoundResult[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{ name: string; profit: number }> | null>(null);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [practice, setPractice] = useState<
    | { running: true; rounds: number; aiCount: number }
    | { running: false; results?: any }
    | null
  >(null);

  // Tutorial state
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    // Resolve server URL: use Vite's build-time env; only fall back to localhost in local dev
    const envUrl = (import.meta as any)?.env?.VITE_SERVER_URL as string | undefined;
    const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const serverUrl = envUrl && envUrl.trim().length > 0
      ? envUrl
      : (isLocalhost ? 'http://localhost:3001' : '');

    if (!serverUrl) {
      console.error('VITE_SERVER_URL is not set. Please configure your backend URL in Vercel project envs.');
      return;
    }

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
          buy: allCodes.reduce((acc, code) => ({ ...acc, [code]: t.decisions?.buy?.[code] ?? 0 }), {} as Record<string, number>),
          fixSeatsPurchased: t.decisions?.fixSeatsPurchased ?? 0,
          // Before allocation is confirmed by server, do not infer allocated seats
          fixSeatsAllocated: t.decisions?.fixSeatsAllocated,
      poolingAllocation: t.decisions?.poolingAllocation ?? 0,
      hotelCapacity: t.decisions?.hotelCapacity
        }
      }));
      setGameState({ ...state, teams: normalizedTeams });
      // Keep currentTeam in sync with backend state (by socket id)
      const myTeam = normalizedTeams.find(t => t.id === newSocket.id);
      if (myTeam) {
        setCurrentTeam(myTeam);
      }
    });

    // Also listen for gameStateUpdate events (broadcasted updates)
    newSocket.on('gameStateUpdate', (state: GameState) => {
      console.log('Game state broadcast updated:', state);
      // Ensure each team has all fare codes initialized
      const allCodes = (state.fares || []).map(f => f.code);
    const normalizedTeams = (state.teams || []).map(t => ({
        ...t,
        decisions: {
          price: t.decisions?.price ?? 199,
          buy: allCodes.reduce((acc, code) => ({ ...acc, [code]: t.decisions?.buy?.[code] ?? 0 }), {} as Record<string, number>),
          fixSeatsPurchased: t.decisions?.fixSeatsPurchased ?? 0,
          fixSeatsAllocated: t.decisions?.fixSeatsAllocated,
      poolingAllocation: t.decisions?.poolingAllocation ?? 0,
      hotelCapacity: t.decisions?.hotelCapacity
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
      setRegistrationError(null); // Clear any previous error
    });

    // Listen for registration error
    newSocket.on('registrationError', (error: string) => {
      console.error('Registration error:', error);
      setRegistrationError(error);
    });

    // Listen for admin login
    newSocket.on('adminLoginSuccess', () => {
      console.log('Admin login successful');
      setIsAdmin(true);
    });

    // Listen for admin login error
    newSocket.on('adminLoginError', (error: string) => {
      console.error('Admin login error:', error);
      setAdminLoginError(error);
    });

    // Listen for round events
    newSocket.on('roundStarted', (roundNumber: number) => {
      console.log('Round started:', roundNumber);
      setRoundResults(null);
      // Note: gameState.isActive will be updated via gameStateUpdate event
    });

    newSocket.on('roundEnded', (data: { roundResults: RoundResult[], roundNumber: number }) => {
      console.log('Round ended:', data.roundNumber);
      setRoundResults(data.roundResults);
      // Note: gameState.isActive will be updated via gameStateUpdate event
    });

    // Listen for leaderboard
    newSocket.on('leaderboard', (board: Array<{ name: string; profit: number }>) => {
      setLeaderboard(board);
    });

    // Practice mode events
    newSocket.on('practiceResults', (payload: any) => {
      setPractice({ running: false, results: payload });
    });
    newSocket.on('practiceError', (msg: string) => {
      console.error('Practice error:', msg);
      setPractice({ running: false });
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

    // Listen for current game reset confirmation
    newSocket.on('currentGameReset', (data: any) => {
      console.log('Current game reset successfully:', data.message);
      console.log('Reset timestamp:', data.timestamp);
      // Reset local state for current game (keep high scores)
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

    newSocket.on('resetComplete', (result: any) => {
      console.log('Reset operation completed:', result);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const registerTeam = (name: string) => {
    setRegistrationError(null); // Clear any previous error
    socket?.emit('registerTeam', name);
  };

  const loginAsAdmin = (password: string) => {
    setAdminLoginError(null); // Clear any previous error
    socket?.emit('adminLogin', password);
  };

  const logoutAsAdmin = () => {
    setIsAdmin(false);
    setAdminLoginError(null);
    // Navigate back to team registration by reloading the page
    window.location.reload();
  };

  const updateGameSettings = (settings: Partial<GameState>) => {
    socket?.emit('updateGameSettings', settings);
  };

  const updateTeamDecision = (decision: { price?: number; buy?: Record<string, number>; fixSeatsPurchased?: number; poolingAllocation?: number }) => {
    // Optimistic local update for snappy UI
    setCurrentTeam(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        decisions: {
          ...prev.decisions,
          ...(decision.price !== undefined ? { price: decision.price } : {}),
          ...(decision.buy ? { buy: { ...prev.decisions.buy, ...decision.buy } } : {}),
          ...(decision.fixSeatsPurchased !== undefined ? { fixSeatsPurchased: decision.fixSeatsPurchased } : {}),
          ...(decision.poolingAllocation !== undefined ? { poolingAllocation: decision.poolingAllocation } : {})
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
            ...(decision.buy ? { buy: { ...t.decisions.buy, ...decision.buy } } : {}),
            ...(decision.fixSeatsPurchased !== undefined ? { fixSeatsPurchased: decision.fixSeatsPurchased } : {}),
            ...(decision.poolingAllocation !== undefined ? { poolingAllocation: decision.poolingAllocation } : {})
          }
        } : t)
      };
    });

    // Notify server
    socket?.emit('updateTeamDecision', decision);
  };

  const startPracticeMode = (config?: { rounds?: number; aiCount?: number; overridePrice?: number }) => {
    const rounds = Math.max(1, Math.min(5, Number(config?.rounds) || 3));
    const aiCount = Math.max(2, Math.min(6, Number(config?.aiCount) || 0));
    setPractice({ running: true, rounds, aiCount });
    socket?.emit('startPracticeMode', config || {});
  };

  const startPrePurchasePhase = () => {
    socket?.emit('startPrePurchasePhase');
  };

  const startSimulationPhase = () => {
    socket?.emit('startSimulationPhase');
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

  const resetCurrentGame = () => {
    console.log('resetCurrentGame function called');
    socket?.emit('resetCurrentGame');
  };

  // Tutorial functions
  const startTutorial = useCallback(() => {
    console.log('Starting tutorial');
    setTutorialActive(true);
    setTutorialStep(0);
  }, []);

  const skipTutorial = useCallback(() => {
    console.log('Skipping tutorial');
    setTutorialActive(false);
    setTutorialStep(0);
    localStorage.setItem('tutorialCompleted', 'true');
  }, []);

  const nextTutorialStep = useCallback(() => {
    setTutorialStep(prev => {
      const nextStep = prev + 1;
      console.log('Moving to tutorial step:', nextStep);
      return nextStep;
    });
  }, []);

  const previousTutorialStep = useCallback(() => {
    setTutorialStep(prev => {
      const prevStep = Math.max(0, prev - 1);
      console.log('Moving to tutorial step:', prevStep);
      return prevStep;
    });
  }, []);

  const completeTutorial = useCallback(() => {
    console.log('Completing tutorial');
    setTutorialActive(false);
    setTutorialStep(0);
    localStorage.setItem('tutorialCompleted', 'true');
  }, []);

  const setTutorialStepDirect = useCallback((step: number) => {
    console.log('Setting tutorial step to:', step);
    setTutorialStep(step);
  }, []);

  const value: GameContextType = {
    socket,
    gameState,
    currentTeam,
    isAdmin,
    roundResults,
  practice,
    leaderboard,
    roundHistory,
    analyticsData,
    registrationError,
    adminLoginError,
    tutorialActive,
    tutorialStep,
    startTutorial,
    skipTutorial,
    nextTutorialStep,
    previousTutorialStep,
    setTutorialStep: setTutorialStepDirect,
    completeTutorial,
    registerTeam,
    loginAsAdmin,
    logoutAsAdmin,
    updateGameSettings,
    updateTeamDecision,
  startPracticeMode,
    startPrePurchasePhase,
    startSimulationPhase,
    endRound,
    getLeaderboard,
    getAnalytics,
    resetAllData,
    resetCurrentGame
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};
