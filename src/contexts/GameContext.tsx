import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { resolveServerUrl } from '@/lib/env';

interface Team {
  id: string;
  name: string;
  decisions: {
    price: number;
    buy: Record<string, number>;
    fixSeatsPurchased: number;
    fixSeatsAllocated?: number; // Actually allocated fix seats (may be less than purchased)
    poolingAllocation: number;
    fixSeatBidPrice?: number | null;
    fixSeatsRequested?: number;
    fixSeatClearingPrice?: number | null;
    // Agent v1 live controls (preview)
    push_level?: 0 | 1 | 2;
    fix_hold_pct?: number;
    tool?: 'none' | 'hedge' | 'spotlight' | 'commit';
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
  totalAircraftSeats: number;
  totalFixSeats: number;
  availableFixSeats: number;
  fixSeatPrice: number;
  poolingCost?: number;
  simulationMonths: number;
  departureDate: Date;
  fixSeatsAllocated?: boolean;
  poolingReserveCapacity?: number;
  poolingMarketUpdateInterval?: number; // in seconds
  simulatedWeeksPerUpdate?: number; // weeks simulated per market update
  demandVolatility?: number;
  priceElasticity?: number;
  marketPriceElasticity?: number;
  referencePrice?: number;
  marketConcentration?: number;
  costVolatility?: number;
  crossElasticity?: number;
  poolingMarket?: {
    currentPrice: number;
    totalPoolingCapacity: number;
    availablePoolingCapacity: number;
    offeredPoolingCapacity: number;
    currentDemand: number;
    lastUpdate: string;
    priceHistory: Array<{ price: number; timestamp: string }>;
  };
  // Budget
  perTeamBudget?: number; // fixed budget per team for the round (both phases)
  // Round timer
  remainingTime?: number;
  // Simulation: remaining days until departure
  simulatedDaysUntilDeparture?: number;
  countdownSeconds?: number;
  // Live simulation state (server-provided) for per-team accumulations
  simState?: {
    perTeam: Record<string, {
      fixRemaining?: number;
      poolRemaining?: number;
      sold?: number;
      poolUsed?: number;
      demand?: number;
      initialFix?: number;
      initialPool?: number;
      revenue?: number;
      cost?: number;
      insolvent?: boolean;
    }>;
    returnedDemandRemaining?: number;
  };
}

interface RoundResult {
  teamId: string;
  sold: number;
  revenue: number;
  cost: number;
  profit: number;
  unsold: number;
  insolvent?: boolean;
}

interface AllocationSummary {
  allocations: Array<{
    teamId: string;
    teamName: string;
    requested: number;
    bidPrice: number;
    allocated: number;
    clearingPrice: number | null;
  }>;
  totalRequested: number;
  totalAllocated: number;
  maxFixCapacity: number;
  poolingReserveCapacity: number;
}

interface GameContextType {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  gameState: GameState;
  currentTeam: Team | null;
  isAdmin: boolean;
  roundResults: RoundResult[] | null;
  lastError: string | null;
  clearLastError: () => void;
  // Practice mode state
  practice:
    | { running: true; rounds: number; aiCount: number }
    | { running: false; results?: any }
    | null;
  leaderboard: Array<{ name: string; revenue: number; profit?: number }> | null;
  roundHistory: any[];
  analyticsData: any;
  registrationError: string | null;
  adminLoginError: string | null;
  allocationSummary: AllocationSummary | null;
  clearAllocationSummary: () => void;

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
  updateTeamDecision: (decision: { price?: number; buy?: Record<string, number>; fixSeatsPurchased?: number; poolingAllocation?: number; fixSeatBidPrice?: number; push_level?: 0 | 1 | 2; fix_hold_pct?: number; tool?: 'none' | 'hedge' | 'spotlight' | 'commit' }) => void;
  startPracticeMode: (config?: { rounds?: number; aiCount?: number; overridePrice?: number }) => void;
  stopPracticeMode: () => void;
  startPrePurchasePhase: () => void;
  startSimulationPhase: () => void;
  endRound: () => void;
  getLeaderboard: () => void;
  getAnalytics: () => void;
  resetAllData: () => void;
  resetCurrentGame: () => void;
  logoutTeam: () => void;
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
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    teams: [],
    currentRound: 0,
    isActive: false,
    baseDemand: 100,
    spread: 50,
    shock: 0.1,
    sharedMarket: true,
    seed: 42,
    roundTime: 180,
    fares: [], // No longer used - simplified to Fix Seats + Pooling only
    currentPhase: 'prePurchase',
    phaseTime: 600, // 10 minutes for pre-purchase phase
    totalCapacity: 1000,
    totalAircraftSeats: 1000,
    totalFixSeats: 500,
    availableFixSeats: 500,
    fixSeatPrice: 60,
    simulationMonths: 12,
    departureDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000), // 12 months from now
    fixSeatsAllocated: false,
    poolingReserveCapacity: 300,
    poolingMarketUpdateInterval: 1, // 1 second = 1 day
    simulatedWeeksPerUpdate: 1, // 1 day per update
    referencePrice: 199,
    marketPriceElasticity: -0.9,
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
  poolingCost: 90,
  perTeamBudget: 20000,
  // Round timer
  remainingTime: 0,
  countdownSeconds: 0
  });
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roundResults, setRoundResults] = useState<RoundResult[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{ name: string; revenue: number; profit?: number }> | null>(null);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [allocationSummary, setAllocationSummary] = useState<AllocationSummary | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [practice, setPractice] = useState<
    | { running: true; rounds: number; aiCount: number }
    | { running: false; results?: any }
    | null
  >(null);
  const liveGameSnapshot = React.useRef<GameState | null>(null);
  const preTimerRef = React.useRef<any>(null);
  const simTimerRef = React.useRef<any>(null);
  const simDataRef = React.useRef<{
    remainingFix: number[];
    remainingPool: number[];
    sold: number[];
    poolUsed: number[];
  } | null>(null);

  // Tutorial state
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    // Resolve server URL using helper to avoid direct import.meta usage
    const serverUrl = resolveServerUrl();
    if (!serverUrl) {
      console.error('VITE_SERVER_URL is not set. Please configure your backend URL in Vercel project envs.');
      return;
    }

  const newSocket = io(serverUrl);
    setSocket(newSocket);

    console.log('Connecting to server:', serverUrl);

    newSocket.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      console.log('Connected to server');

      // Try to resume existing session using stored token
      const token = localStorage.getItem('apxo_resume_token');
      if (token) {
        newSocket.emit('resumeTeam', token, (res: any) => {
          if (res?.ok && res.team) {
            setCurrentTeam(res.team);
          }
        });
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setIsReconnecting(true);
      console.log('Disconnected from server');
    });

    // Listen for game state updates
    newSocket.on('gameState', (state: GameState) => {
      // If practice runs but a live phase is active, abort practice and sync
      if (practice?.running && state?.isActive) {
        stopPracticeMode();
      }
      if (practice?.running) return; // otherwise ignore server while practicing
      console.log('Game state updated:', state);
      // Ensure each team has all fare codes initialized
      const allCodes = (state.fares || []).map(f => f.code);
      const normalizedTeams = (state.teams || []).map(t => ({
        ...t,
        decisions: {
          price: t.decisions?.price ?? 500,
          buy: allCodes.reduce((acc, code) => ({ ...acc, [code]: t.decisions?.buy?.[code] ?? 0 }), {} as Record<string, number>),
          fixSeatsPurchased: t.decisions?.fixSeatsPurchased ?? 0,
          // Before allocation is confirmed by server, do not infer allocated seats
          fixSeatsAllocated: t.decisions?.fixSeatsAllocated,
          poolingAllocation: t.decisions?.poolingAllocation ?? 0,
          fixSeatsRequested: t.decisions?.fixSeatsRequested ?? t.decisions?.fixSeatsPurchased ?? 0,
          fixSeatBidPrice: t.decisions?.fixSeatBidPrice ?? null,
          fixSeatClearingPrice: t.decisions?.fixSeatClearingPrice ?? null
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
      if (practice?.running && state?.isActive) {
        stopPracticeMode();
      }
      if (practice?.running) return; // ignore server while practicing
      console.log('Game state broadcast updated:', state);

      // Ensure each team has all fare codes initialized
      const allCodes = (state.fares || []).map(f => f.code);
      const normalizedTeams = (state.teams || []).map(t => ({
        ...t,
        decisions: {
          price: t.decisions?.price ?? 500,
          buy: allCodes.reduce((acc, code) => ({ ...acc, [code]: t.decisions?.buy?.[code] ?? 0 }), {} as Record<string, number>),
          fixSeatsPurchased: t.decisions?.fixSeatsPurchased ?? 0,
          fixSeatsAllocated: t.decisions?.fixSeatsAllocated,
          poolingAllocation: t.decisions?.poolingAllocation ?? 0,
          fixSeatsRequested: t.decisions?.fixSeatsRequested ?? t.decisions?.fixSeatsPurchased ?? 0,
          fixSeatBidPrice: t.decisions?.fixSeatBidPrice ?? null,
          fixSeatClearingPrice: t.decisions?.fixSeatClearingPrice ?? null
        }
      }));
      setGameState({ ...state, teams: normalizedTeams });
      // Keep currentTeam in sync with backend state (by socket id)
      const myTeam = normalizedTeams.find(t => t.id === newSocket.id);
      if (myTeam) {
        setCurrentTeam(myTeam);
      }
    });

    const handlePhaseStarted = (phase: string) => {
      if (practice?.running) {
        stopPracticeMode();
      }
      if (phase === 'prePurchase') {
        setAllocationSummary(null);
      }
    };
    newSocket.on('phaseStarted', handlePhaseStarted);

    const handleFixSeatsAllocated = (result: AllocationSummary) => {
      if (practice?.running) return;
      setAllocationSummary(result);
    };
    newSocket.on('fixSeatsAllocated', handleFixSeatsAllocated);

    // Listen for registration success
    newSocket.on('registrationSuccess', (team: Team) => {
      console.log('Team registered:', team);
      setCurrentTeam(team);
      setRegistrationError(null); // Clear any previous error
    });

    // Receive resume token and persist it
    newSocket.on('resumeToken', (token: string) => {
      if (token) localStorage.setItem('apxo_resume_token', token);
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
    newSocket.on('leaderboard', (board: Array<{ name: string; revenue: number; profit?: number }>) => {
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
      setAllocationSummary(null);
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
      setAllocationSummary(null);
    });

    newSocket.on('resetComplete', (result: any) => {
      console.log('Reset operation completed:', result);
    });

    return () => {
      newSocket.off('phaseStarted', handlePhaseStarted);
      newSocket.off('fixSeatsAllocated', handleFixSeatsAllocated);
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

  // Explicit team logout (user-initiated)
  const logoutTeam = () => {
    socket?.emit('logoutTeam', () => {
      // Clear local token regardless of result
      localStorage.removeItem('apxo_resume_token');
      setCurrentTeam(null);
      // Optional: navigate to registration view
      window.location.reload();
    });
  };

  const updateGameSettings = (settings: Partial<GameState>) => {
    socket?.emit('updateGameSettings', settings);
  };

  const updateTeamDecision = (decision: { price?: number; buy?: Record<string, number>; fixSeatsPurchased?: number; poolingAllocation?: number; fixSeatBidPrice?: number; push_level?: 0 | 1 | 2; fix_hold_pct?: number; tool?: 'none' | 'hedge' | 'spotlight' | 'commit' }) => {
    // Handle in-practice locally
    if (practice?.running) {
      // Local update only
      setCurrentTeam(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          decisions: {
            ...prev.decisions,
            ...(decision.price !== undefined ? { price: decision.price } : {}),
            ...(decision.buy ? { buy: { ...prev.decisions.buy, ...decision.buy } } : {}),
            ...(decision.fixSeatsPurchased !== undefined ? { fixSeatsPurchased: decision.fixSeatsPurchased, fixSeatsRequested: decision.fixSeatsPurchased } : {}),
            ...(decision.poolingAllocation !== undefined ? { poolingAllocation: decision.poolingAllocation } : {}),
            ...(decision.fixSeatBidPrice !== undefined ? { fixSeatBidPrice: decision.fixSeatBidPrice } : {}),
            ...(decision.push_level !== undefined ? { push_level: decision.push_level } : {}),
            ...(decision.fix_hold_pct !== undefined ? { fix_hold_pct: decision.fix_hold_pct } : {}),
            ...(decision.tool !== undefined ? { tool: decision.tool } : {})
          }
        };
      });
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
              ...(decision.fixSeatsPurchased !== undefined ? { fixSeatsPurchased: decision.fixSeatsPurchased, fixSeatsRequested: decision.fixSeatsPurchased } : {}),
              ...(decision.poolingAllocation !== undefined ? { poolingAllocation: decision.poolingAllocation } : {}),
              ...(decision.fixSeatBidPrice !== undefined ? { fixSeatBidPrice: decision.fixSeatBidPrice } : {}),
              ...(decision.push_level !== undefined ? { push_level: decision.push_level } : {}),
              ...(decision.fix_hold_pct !== undefined ? { fix_hold_pct: decision.fix_hold_pct } : {}),
              ...(decision.tool !== undefined ? { tool: decision.tool } : {})
            }
          } : t)
        };
      });
      return;
    }

    // Capture previous state for rollback if server rejects
    const prevTeam = currentTeam;
    const prevGameState = gameState;

    // Optimistic local update for snappy UI
    setCurrentTeam(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        decisions: {
          ...prev.decisions,
          ...(decision.price !== undefined ? { price: decision.price } : {}),
          ...(decision.buy ? { buy: { ...prev.decisions.buy, ...decision.buy } } : {}),
          ...(decision.fixSeatsPurchased !== undefined ? { fixSeatsPurchased: decision.fixSeatsPurchased, fixSeatsRequested: decision.fixSeatsPurchased } : {}),
          ...(decision.poolingAllocation !== undefined ? { poolingAllocation: decision.poolingAllocation } : {}),
          ...(decision.fixSeatBidPrice !== undefined ? { fixSeatBidPrice: decision.fixSeatBidPrice } : {}),
          ...(decision.push_level !== undefined ? { push_level: decision.push_level } : {}),
          ...(decision.fix_hold_pct !== undefined ? { fix_hold_pct: decision.fix_hold_pct } : {}),
          ...(decision.tool !== undefined ? { tool: decision.tool } : {})
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
            ...(decision.fixSeatsPurchased !== undefined ? { fixSeatsPurchased: decision.fixSeatsPurchased, fixSeatsRequested: decision.fixSeatsPurchased } : {}),
            ...(decision.poolingAllocation !== undefined ? { poolingAllocation: decision.poolingAllocation } : {}),
            ...(decision.fixSeatBidPrice !== undefined ? { fixSeatBidPrice: decision.fixSeatBidPrice } : {}),
            ...(decision.push_level !== undefined ? { push_level: decision.push_level } : {}),
            ...(decision.fix_hold_pct !== undefined ? { fix_hold_pct: decision.fix_hold_pct } : {}),
            ...(decision.tool !== undefined ? { tool: decision.tool } : {})
          }
        } : t)
      };
    });

    // Debounced emit with ACK
    const s = socket;
    if (!s) return;

    // Small debounce to batch rapid changes
  setTimeout(() => {
    s.emit('updateTeamDecision', decision, (res: any) => {
        if (!res?.ok) {
          console.warn('Server rejected decision update:', res?.error);
          // Rollback
          setCurrentTeam(prevTeam || null);
          setGameState(prevGameState);
      setLastError(res?.error || 'Update rejected');
        }
      });
    }, 200);

    // If needed, we could track and clear timeouts per input field
  };

  const startPracticeMode = (config?: { rounds?: number; aiCount?: number; overridePrice?: number; overrideFixSeats?: number; overrideBid?: number }) => {
    // Toggle off if running
    if (practice?.running) { stopPracticeMode(); return; }
    // Do not allow starting practice while a live game is active
    if (gameState.isActive) {
      setLastError('Practice mode cannot be started while a live game is running.');
      return;
    }

    const aiCount = Math.max(2, Math.min(6, Number(config?.aiCount) || 3));
    setPractice({ running: true, rounds: 1, aiCount });
    setAllocationSummary(null);
    // Snapshot live state
    liveGameSnapshot.current = gameState;

    // Build randomized practice state mirroring server
    const rnd = (min: number, max: number) => Math.random() * (max - min) + min;
    const irnd = (min: number, max: number) => Math.floor(rnd(min, max + 1));

    const totalAircraftSeats = irnd(600, 1400);
    const perTeamCount = aiCount + 1;
    const fixSeatPrice = irnd(50, 80);
    const poolingCost = irnd(70, 120);
  const perTeamBudget = irnd(15000, 40000);
    const departureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // Construct teams: current + AIs
    const myId = socket?.id || 'me';
    const myTeam: Team = {
      id: myId,
      name: currentTeam?.name || 'You',
      decisions: {
        price: typeof config?.overridePrice === 'number' ? config.overridePrice : (currentTeam?.decisions?.price ?? 500),
        buy: {},
        fixSeatsPurchased: currentTeam?.decisions?.fixSeatsPurchased ?? 0,
        fixSeatsRequested: currentTeam?.decisions?.fixSeatsRequested ?? currentTeam?.decisions?.fixSeatsPurchased ?? 0,
        fixSeatBidPrice: currentTeam?.decisions?.fixSeatBidPrice ?? fixSeatPrice,
        fixSeatClearingPrice: currentTeam?.decisions?.fixSeatClearingPrice ?? null,
        poolingAllocation: currentTeam?.decisions?.poolingAllocation ?? 0
      },
      totalProfit: 0
    };
    const aiTeams: Team[] = Array.from({ length: aiCount }).map((_, i) => ({
      id: `AI_${i + 1}`,
      name: `AI Team ${i + 1}`,
      decisions: {
        price: irnd(180, 280),
        buy: {},
        fixSeatsPurchased: irnd(10, 120),
        fixSeatsRequested: irnd(10, 120),
        fixSeatBidPrice: irnd(50, 120),
        fixSeatClearingPrice: null,
        poolingAllocation: irnd(10, 80)
      },
      totalProfit: 0
    }));

    const practiceState: GameState = {
      ...gameState,
      teams: [myTeam, ...aiTeams],
      isActive: false,
      currentRound: 1,
      baseDemand: irnd(80, 240),
      demandVolatility: Number(rnd(0.05, 0.2).toFixed(2)),
      priceElasticity: Number((-rnd(0.9, 2.7)).toFixed(2)),
      crossElasticity: Number(rnd(0.0, 1.0).toFixed(2)),
      marketConcentration: Number(rnd(0.5, 0.9).toFixed(2)),
      roundTime: 60, // seconds for pre-purchase
      currentPhase: 'prePurchase',
      phaseTime: 60,
      totalCapacity: totalAircraftSeats,
      totalAircraftSeats,
  totalFixSeats: Math.floor(totalAircraftSeats * 0.7),
  availableFixSeats: Math.floor(totalAircraftSeats * 0.7),
      fixSeatPrice,
  perTeamBudget,
      poolingMarketUpdateInterval: 1,
      simulatedWeeksPerUpdate: 1,
      departureDate,
      remainingTime: 0,
      simulatedDaysUntilDeparture: Math.ceil((departureDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      poolingMarket: {
        currentPrice: irnd(100, 220),
        totalPoolingCapacity: Math.floor(totalAircraftSeats * 0.3),
        availablePoolingCapacity: Math.floor(totalAircraftSeats * 0.3),
        offeredPoolingCapacity: 0,
        currentDemand: 0,
        lastUpdate: new Date().toISOString(),
        priceHistory: []
      }
    };

    setGameState(practiceState);

    // Start Pre-Purchase timer (1 min)
    setGameState(prev => ({ ...prev, isActive: true, remainingTime: 60 }));
    preTimerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.currentPhase !== 'prePurchase') return prev;
        const rt = Math.max(0, (prev.remainingTime || 0) - 1);
        if (rt <= 0) {
          clearInterval(preTimerRef.current);
          // allocate fix seats via local auction logic
          const poolingReserveRatio = 0.3;
          const maxFixCapacity = Math.floor((prev.totalAircraftSeats || 1000) * (1 - poolingReserveRatio));
          const budget = Number(prev.perTeamBudget || 0);
          const defaultBid = Number(prev.fixSeatPrice || 60) || 60;

          const requests = prev.teams.map(team => {
            const rawRequested = Math.max(0, Math.floor(Number(team.decisions?.fixSeatsPurchased || 0)));
            const rawBid = team.decisions?.fixSeatBidPrice ?? defaultBid;
            const bidPrice = Number.isFinite(Number(rawBid)) && Number(rawBid) > 0 ? Math.round(Number(rawBid)) : defaultBid;
            let capped = rawRequested;
            if (budget > 0 && bidPrice > 0) {
              capped = Math.min(capped, Math.floor(budget / bidPrice));
            }
            return { team, teamId: team.id, requested: rawRequested, capped, bidPrice };
          });

          const grouped = [...requests]
            .sort((a, b) => {
              if (b.bidPrice !== a.bidPrice) return b.bidPrice - a.bidPrice;
              return a.teamId.localeCompare(b.teamId);
            })
            .reduce((map, req) => {
              if (!map.has(req.bidPrice)) map.set(req.bidPrice, [] as typeof requests);
              map.get(req.bidPrice)!.push(req);
              return map;
            }, new Map<number, typeof requests>());

          let remaining = maxFixCapacity;
          const allocationMap = new Map<string, { allocated: number; price: number; requested: number }>();

          for (const [price, group] of grouped.entries()) {
            if (remaining <= 0) {
              group.forEach(req => allocationMap.set(req.teamId, { allocated: 0, price, requested: req.capped }));
              continue;
            }
            const totalGroupRequested = group.reduce((sum, req) => sum + req.capped, 0);
            if (totalGroupRequested <= remaining) {
              for (const req of group) {
                allocationMap.set(req.teamId, { allocated: req.capped, price, requested: req.capped });
                remaining -= req.capped;
              }
              continue;
            }

            const ratio = remaining / totalGroupRequested;
            const provisional = group.map(req => {
              const exact = req.capped * ratio;
              const base = Math.floor(exact);
              const remainder = exact - base;
              return { req, base, remainder };
            });
            let seatsLeft = remaining - provisional.reduce((sum, item) => sum + item.base, 0);
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
              allocationMap.set(item.req.teamId, { allocated: item.base + extra, price, requested: item.req.capped });
            }
            remaining = 0;
          }

          const teams = prev.teams.map(t => {
            const alloc = allocationMap.get(t.id);
            const allocated = alloc ? alloc.allocated : 0;
            const bidPrice = Number.isFinite(Number(t.decisions?.fixSeatBidPrice)) && Number(t.decisions?.fixSeatBidPrice) > 0
              ? Math.round(Number(t.decisions?.fixSeatBidPrice))
              : defaultBid;
            const clearingPrice = allocated > 0 ? (alloc ? alloc.price : bidPrice) : null;
            return {
              ...t,
              decisions: {
                ...t.decisions,
                fixSeatsRequested: alloc ? alloc.requested : Math.max(0, Math.floor(Number(t.decisions?.fixSeatsPurchased || 0))),
                fixSeatsPurchased: allocated,
                fixSeatsAllocated: allocated,
                fixSeatBidPrice: bidPrice,
                fixSeatClearingPrice: clearingPrice
              }
            };
          });
          // reflect allocation in currentTeam
          const updatedMe = teams.find(t => t.id === myId) || null;
          if (updatedMe) {
            setTimeout(() => setCurrentTeam(updatedMe), 0);
          }
          // Move to simulation phase
          const dep = prev.departureDate ? new Date(prev.departureDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          const secondsToDeparture = Math.max(0, Math.round((dep.getTime() - Date.now()) / 1000));
          const daysToDeparture = Math.max(0, Math.ceil(secondsToDeparture / (24 * 60 * 60)));
          // start simulation interval
          setTimeout(() => {
            setGameState(p => ({
              ...p,
              teams,
              isActive: true,
              currentPhase: 'simulation',
              remainingTime: undefined,
              simulatedDaysUntilDeparture: daysToDeparture,
              countdownSeconds: daysToDeparture
            }));
            const meNow = teams.find(t => t.id === myId) || null;
            if (meNow) setCurrentTeam(meNow);
            // Initialize per-tick matching state (remaining capacities & sold tracking)
            simDataRef.current = {
              remainingFix: teams.map(t => Math.max(0, t.decisions?.fixSeatsAllocated || 0)),
              remainingPool: teams.map(t => Math.max(0, Math.round((totalAircraftSeats) * ((t.decisions?.poolingAllocation || 0) / 100)))),
              sold: teams.map(() => 0),
              poolUsed: teams.map(() => 0)
            };
            startSimInterval();
          }, 0);
          return { ...prev, isActive: false, remainingTime: 0, teams };
        }
        return { ...prev, remainingTime: rt };
      });
    }, 1000);

    const startSimInterval = () => {
      simTimerRef.current = setInterval(() => {
        setGameState(prev => {
          // Only check the phase; stopping is handled via stopPracticeMode()
          if (prev.currentPhase !== 'simulation') return prev;
          const previousDays = typeof prev.simulatedDaysUntilDeparture === 'number'
            ? prev.simulatedDaysUntilDeparture
            : (typeof prev.countdownSeconds === 'number'
              ? Math.max(0, prev.countdownSeconds)
              : Math.max(0, Math.ceil(((prev.departureDate ? new Date(prev.departureDate).getTime() : Date.now()) - Date.now()) / (24 * 60 * 60 * 1000))));
          const daysRemaining = Math.max(0, previousDays - 1);
          const countdownSeconds = daysRemaining;

          // Per-tick demand (daily baseline)
          const baseD = Math.max(10, prev.baseDemand || 100);
          const demandToday = Math.round(baseD * (0.8 + Math.random() * 0.4));

          // Price-dependent demand distribution across teams (softmax around the average price)
          const teams = prev.teams.map(t => ({
            ...t,
            decisions: {
              ...t.decisions,
              price: typeof t.decisions?.price === 'number' ? t.decisions.price : 500
            }
          }));
          const avgPrice = teams.reduce((s, t) => s + (t.decisions.price || 500), 0) / Math.max(1, teams.length);
          const elasticity = Math.abs(prev.priceElasticity || 1); // typically 0.9..2.7 from the practice setup
          const k = Math.min(0.08, Math.max(0.008, elasticity / 50)); // 0.018..0.054
          const weights = teams.map(t => Math.exp(-k * ((t.decisions.price || 500) - avgPrice)));
          const sumW = weights.reduce((a, b) => a + b, 0) || 1;
          const demandPerTeam = teams.map((_, i) => Math.max(0, Math.round(demandToday * (weights[i] / sumW))));

          // Per-tick matching: manage remaining capacities
          if (!simDataRef.current || (simDataRef.current.remainingFix.length !== teams.length)) {
            // Fallback init if values were not provided
            simDataRef.current = {
              remainingFix: teams.map(t => Math.max(0, t.decisions?.fixSeatsAllocated || 0)),
              remainingPool: teams.map(t => Math.max(0, Math.round((prev.totalAircraftSeats || 1000) * ((t.decisions?.poolingAllocation || 0) / 100)))),
              sold: teams.map(() => 0),
              poolUsed: teams.map(() => 0)
            };
          }
          const data = simDataRef.current!;

          // Pricing before consumption: use pre-tick available pooling supply and remaining fixed seats
          const remainingFixBefore = data.remainingFix.slice();
          const remainingPoolBefore = data.remainingPool.slice();
          const poolingDemand = demandPerTeam.reduce((s, d, i) => s + Math.max(0, d - remainingFixBefore[i]), 0);
          const poolingOfferedBefore = remainingPoolBefore.reduce((a, b) => a + b, 0);

          // Pool price dynamics with mean reversion and light noise
          const pm = prev.poolingMarket || { currentPrice: 150, totalPoolingCapacity: Math.floor((prev.totalAircraftSeats || 1000) * 0.3), availablePoolingCapacity: Math.floor((prev.totalAircraftSeats || 1000) * 0.3), offeredPoolingCapacity: 0, currentDemand: 0, lastUpdate: new Date().toISOString(), priceHistory: [] as any[] };
          const ratioSD = poolingOfferedBefore / Math.max(1, poolingDemand);
          let delta = 0;
          if (ratioSD < 0.9) delta = Math.min(20, (0.9 - ratioSD) * 40);
          else if (ratioSD > 1.1) delta = Math.max(-20, (ratioSD - 1.1) * -30);

          const currentPrice = Math.max(1, pm.currentPrice || Math.round((poolingCost || 90) * 1.1));
          const shouldUpdatePrice = daysRemaining === 0 || daysRemaining % 7 === 0 || !Number.isFinite(currentPrice);
          let newPrice = currentPrice;
          let priceHistory = Array.isArray(pm.priceHistory) ? [...pm.priceHistory] : [];

          if (shouldUpdatePrice || priceHistory.length === 0) {
            const baseline = (poolingCost || 90) * 1.2; // slight markup above cost
            const noise = (Math.random() - 0.5) * 2; // -1..1
            const drift = (baseline - currentPrice) * 0.02; // Mean-Reversion
            const rawPrice = currentPrice + delta * 0.35 + drift + noise;
            const bounded = Math.max(80, Math.min(300, rawPrice));
            newPrice = Math.round(bounded);
            priceHistory = [...priceHistory, { price: newPrice, timestamp: new Date().toISOString(), demand: poolingDemand, remainingDays: daysRemaining }].slice(-30);
          }

          // Matching: consume fixed seats first, then pooling
          teams.forEach((_, i) => {
            let need = demandPerTeam[i];
            const serveFix = Math.min(need, data.remainingFix[i]);
            data.remainingFix[i] -= serveFix;
            need -= serveFix;
            const servePool = Math.min(need, data.remainingPool[i]);
            data.remainingPool[i] -= servePool;
            need -= servePool;
            data.sold[i] += (serveFix + servePool);
            data.poolUsed[i] += servePool;
          });

          const poolingOfferedAfter = data.remainingPool.reduce((a, b) => a + b, 0);
          const updatedPM = {
            ...pm,
            currentPrice: newPrice,
            offeredPoolingCapacity: poolingOfferedAfter,
            currentDemand: poolingDemand,
            lastUpdate: new Date().toISOString(),
            priceHistory
          };

          if (countdownSeconds <= 0) {
            clearInterval(simTimerRef.current);
            // Evaluate current team summary
            const meIndex = teams.findIndex(t => t.id === myId);
            const myPrice = teams[meIndex]?.decisions.price || 500;
            const sold = meIndex >= 0 ? data.sold[meIndex] : 0;
            const poolUsed = meIndex >= 0 ? data.poolUsed[meIndex] : 0;
            const myFixAllocated = teams[meIndex]?.decisions?.fixSeatsAllocated || 0;
            const avgPoolingUnit = (updatedPM.priceHistory && updatedPM.priceHistory.length > 0)
              ? Math.round(updatedPM.priceHistory.reduce((s, p) => s + (p.price || 0), 0) / updatedPM.priceHistory.length)
              : (poolingCost || 90);
            const revenue = sold * myPrice;
            const clearingUnit = Number.isFinite(Number(teams[meIndex]?.decisions?.fixSeatClearingPrice)) && Number(teams[meIndex]?.decisions?.fixSeatClearingPrice) > 0
              ? Number(teams[meIndex]?.decisions?.fixSeatClearingPrice)
              : (prev.fixSeatPrice || 60);
            const fixSeatCost = myFixAllocated * clearingUnit;
            const poolingUsageCost = poolUsed * avgPoolingUnit;
            const variableCost = sold * 15;
            const cost = fixSeatCost + poolingUsageCost + variableCost;
            const profit = Math.round(revenue - cost);
            const budget = Number(prev.perTeamBudget || 0);
            const insolvent = (profit < 0 && Math.abs(profit) > budget) ? true : false; // stricter: loss bigger than budget
            const rr = [{ teamId: myId, sold, revenue: Math.round(revenue), cost: Math.round(cost), profit, unsold: Math.max(0, (teams[meIndex] ? 0 : demandToday) ), insolvent }];
            setRoundResults(rr);
            return {
              ...prev,
              isActive: false,
              simulatedDaysUntilDeparture: 0,
              countdownSeconds: 0,
              poolingMarket: updatedPM
            } as GameState;
          }

          return {
            ...prev,
            simulatedDaysUntilDeparture: daysRemaining,
            countdownSeconds,
            poolingMarket: updatedPM
          } as GameState;
        });
      }, 1000);
    };
  };

  const stopPracticeMode = () => {
    if (preTimerRef.current) clearInterval(preTimerRef.current);
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    setPractice({ running: false });
    // Restore live state
    if (liveGameSnapshot.current) {
      setGameState(liveGameSnapshot.current);
      liveGameSnapshot.current = null;
    }
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

  const clearAllocationSummary = useCallback(() => {
    setAllocationSummary(null);
  }, []);

  const value: GameContextType = {
    socket,
  isConnected,
  isReconnecting,
    gameState,
    currentTeam,
    isAdmin,
    roundResults,
  lastError,
  clearLastError: () => setLastError(null),
  practice,
    leaderboard,
    roundHistory,
    analyticsData,
    registrationError,
    adminLoginError,
    allocationSummary,
    clearAllocationSummary,
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
  stopPracticeMode,
    startPrePurchasePhase,
    startSimulationPhase,
    endRound,
    getLeaderboard,
    getAnalytics,
    resetAllData,
  resetCurrentGame,
  logoutTeam
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};
