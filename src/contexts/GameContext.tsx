import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { resolveServerUrl } from '@/lib/env';
import { defaultConfig } from '@/lib/simulation/defaultConfig';

const MIN_PROFIT_LIMIT = -20000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function buildPracticeDemandSchedule(options: {
  horizonDays: number;
  totalCapacity: number;
  baselineCapacity: number;
  demandCurve: number[];
}) {
  const { horizonDays, totalCapacity, baselineCapacity, demandCurve } = options;
  const safeHorizon = Math.max(1, Math.floor(horizonDays));
  const baseCurve = Array.isArray(demandCurve) && demandCurve.length > 0 ? demandCurve : [1];
  const scale = totalCapacity / Math.max(1, baselineCapacity);
  const scaledCurve = baseCurve.map(entry => Math.max(0, entry * scale));
  const periods = scaledCurve.length;
  const basePeriodDays = Math.floor(safeHorizon / periods);
  const extraDays = safeHorizon - basePeriodDays * periods;
  const schedule: number[] = [];

  for (let i = 0; i < periods; i += 1) {
    const periodDays = basePeriodDays + (i < extraDays ? 1 : 0);
    const totalPeriodDemand = Math.max(0, Math.round(scaledCurve[i]));
    if (periodDays <= 0) continue;

    const basePerDay = Math.floor(totalPeriodDemand / periodDays);
    let remainder = totalPeriodDemand - basePerDay * periodDays;

    for (let d = 0; d < periodDays; d += 1) {
      schedule.push(basePerDay);
    }

    if (remainder > 0 && periodDays > 0) {
      const indices = Array.from({ length: periodDays }, (_, idx) => idx);
      for (let j = indices.length - 1; j > 0; j -= 1) {
        const swap = Math.floor(Math.random() * (j + 1));
        [indices[j], indices[swap]] = [indices[swap], indices[j]];
      }
      for (let r = 0; r < remainder; r += 1) {
        const idx = indices[r % periodDays];
        const globalIndex = schedule.length - periodDays + idx;
        schedule[globalIndex] = schedule[globalIndex] + 1;
      }
    }
  }

  while (schedule.length < safeHorizon) {
    const last = schedule.length ? schedule[schedule.length - 1] : 0;
    schedule.push(last);
  }
  if (schedule.length > safeHorizon) {
    schedule.length = safeHorizon;
  }

  const total = schedule.reduce((sum, value) => sum + value, 0);
  const average = safeHorizon > 0 ? Math.round(total / safeHorizon) : 0;
  return { schedule, total, average };
}


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
  fixSeatShare?: number;
  fixSeatMinBid?: number;
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
  airlinePriceMin?: number;
  airlinePriceMax?: number;
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
    requestedOriginal?: number;
    bidPrice: number;
    allocated: number;
    clearingPrice: number | null;
    disqualifiedForLowBid?: boolean;
    minRequiredBid?: number;
  }>;
  totalRequested: number;
  totalAllocated: number;
  maxFixCapacity: number;
  poolingReserveCapacity: number;
  minimumBidPrice?: number;
}

type RoundEndedPayload = {
  roundResults: RoundResult[];
  currentRound?: number;
  roundNumber?: number;
  timestamp?: string;
};

type PendingServerSync = {
  gameState?: GameState;
  roundStarted?: number;
  roundEnded?: RoundEndedPayload;
  allocationSummary?: AllocationSummary | null;
  leaderboard?: Array<{ name: string; revenue: number; profit?: number }>;
};

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
  const initialTeamCount = Array.isArray(defaultConfig?.teams) ? defaultConfig.teams.length : 0;
  const initialFixShare = Math.min(0.95, Math.max(0, initialTeamCount * 0.08));
  const initialFixSeats = Math.round(1000 * initialFixShare);
  const initialPoolingCapacity = Math.max(0, 1000 - initialFixSeats);
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
    fixSeatShare: initialFixShare,
    totalFixSeats: initialFixSeats,
    availableFixSeats: initialFixSeats,
    fixSeatPrice: 60,
    fixSeatMinBid: defaultConfig?.airline?.P_min ?? 80,
    simulationMonths: 12,
    departureDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000), // 12 months from now
    fixSeatsAllocated: false,
    poolingReserveCapacity: initialPoolingCapacity,
    poolingMarketUpdateInterval: 1, // 1 second = 7 days
    simulatedWeeksPerUpdate: 7, // 7 days per update
    referencePrice: 199,
    marketPriceElasticity: -0.9,
    airlinePriceMin: defaultConfig?.airline?.P_min ?? 80,
    airlinePriceMax: defaultConfig?.airline?.P_max ?? 400,
    poolingMarket: {
      currentPrice: 150,
      totalPoolingCapacity: initialPoolingCapacity,
      availablePoolingCapacity: initialPoolingCapacity,
      offeredPoolingCapacity: 0,
      currentDemand: 100,
      lastUpdate: new Date().toISOString(),
      priceHistory: [{ price: 150, timestamp: new Date().toISOString() }]
  },
  // Hotel defaults in initial state (will be overwritten by server)
  poolingCost: 90,
  perTeamBudget: 10000,
  // Round timer
  remainingTime: 0,
  countdownSeconds: 0
  });
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const isAdminRef = React.useRef(isAdmin);
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
  const practiceRef = React.useRef<typeof practice>(practice);
  const pendingServerSyncRef = React.useRef<PendingServerSync | null>(null);
  const socketIdRef = React.useRef<string | null>(null);
  const liveGameSnapshot = React.useRef<GameState | null>(null);
  const preTimerRef = React.useRef<any>(null);
  const simTimerRef = React.useRef<any>(null);
  const simDataRef = React.useRef<{
    remainingFix: number[];
    remainingPool: number[];
    sold: number[];
    poolUsed: number[];
    revenue: number[];
    cost: number[];
    demand: number[];
    initialFix: number[];
    initialPool: number[];
    insolvent: boolean[];
    demandSchedule: number[];
    dayIndex: number;
    totalDays: number;
  } | null>(null);

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);
  const latestGameStateRef = React.useRef<GameState>(gameState);
  const roundHistoryRef = React.useRef<any[]>(roundHistory);

  useEffect(() => {
    latestGameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    roundHistoryRef.current = roundHistory;
  }, [roundHistory]);

  useEffect(() => {
    practiceRef.current = practice;
  }, [practice]);

  const extractRoundKey = (entry: any) => {
    const value = Number(entry?.roundNumber ?? entry?.round ?? entry?.id);
    return Number.isFinite(value) ? value : null;
  };

  const mergeRoundHistoryEntries = (existing: any[], incoming: any[], preferIncoming = false) => {
    if (!Array.isArray(existing) && !Array.isArray(incoming)) return [];
    const map = new Map<number, any>();

    if (Array.isArray(existing)) {
      existing.forEach(entry => {
        const key = extractRoundKey(entry);
        if (key === null) return;
        map.set(key, entry);
      });
    }

    if (Array.isArray(incoming)) {
      incoming.forEach(entry => {
        const key = extractRoundKey(entry);
        if (key === null) return;
        const current = map.get(key);
        if (!current) {
          map.set(key, entry);
          return;
        }
        const merged = preferIncoming
          ? {
            ...current,
            ...entry,
            teamResults: Array.isArray(entry?.teamResults) ? entry.teamResults : current.teamResults
          }
          : {
            ...entry,
            ...current,
            teamResults: Array.isArray(current?.teamResults) ? current.teamResults : entry.teamResults
          };
        map.set(key, merged);
      });
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, value]) => value);
  };

  const resolveIncomingRoundNumber = (payload: { currentRound?: number; roundNumber?: number }) => {
    if (typeof payload?.roundNumber === 'number' && Number.isFinite(payload.roundNumber)) {
      return payload.roundNumber;
    }
    if (typeof payload?.currentRound === 'number' && Number.isFinite(payload.currentRound)) {
      const derived = payload.currentRound - 1;
      if (Number.isFinite(derived)) return derived;
    }
    return undefined;
  };

  const computeRoundEntryTotals = (results: RoundResult[]) => {
    return results.reduce(
      (acc, result) => {
        const sold = Number(result?.sold ?? 0);
        const revenue = Number(result?.revenue ?? 0);
        const cost = Number(result?.cost ?? 0);
        const profit = Number(result?.profit ?? 0);
        const demand = Number((result as any)?.demand ?? 0);

        acc.totalSold += Number.isFinite(sold) ? sold : 0;
        acc.totalRevenue += Number.isFinite(revenue) ? revenue : 0;
        acc.totalCost += Number.isFinite(cost) ? cost : 0;
        acc.totalProfit += Number.isFinite(profit) ? profit : 0;
        acc.totalDemand += Number.isFinite(demand) ? demand : 0;
        return acc;
      },
      {
        totalDemand: 0,
        totalSold: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0
      }
    );
  };

  const buildRoundHistoryEntry = (roundNumber: number, results: RoundResult[], timestamp: string) => {
    const teams = latestGameStateRef.current?.teams ?? [];
    const teamNameMap = new Map<string, string>(teams.map(team => [team.id, team.name]));
    const profits = results.map(result => Number(result?.profit ?? 0));
    const maxProfit = profits.length > 0 ? Math.max(...profits) : 0;
    const minProfit = profits.length > 0 ? Math.min(...profits) : 0;
    const range = Math.max(1, maxProfit - minProfit);

    const teamResults = results.map(result => {
      const profit = Number(result?.profit ?? 0);
      const points = profits.length === 0
        ? 0
        : maxProfit === minProfit
          ? (profit > 0 ? 10 : 0)
          : Math.max(0, Math.min(10, Math.round(((profit - minProfit) / range) * 10)));
      const teamName = teamNameMap.get(result.teamId) ?? (result as any)?.teamName ?? `Team ${String(result.teamId).slice(0, 4)}`;
      return {
        ...result,
        teamName,
        points
      };
    });

    const totals = computeRoundEntryTotals(results);
    const totalSold = totals.totalSold || 0;
    const weightedPriceSum = results.reduce((sum, result) => {
      const sold = Number(result?.sold ?? 0);
      const avgPrice =
        Number((result as any)?.avgPrice) ||
        (sold > 0 ? Number(result?.revenue ?? 0) / sold : 0);
      return sum + (Number.isFinite(avgPrice) ? avgPrice * sold : 0);
    }, 0);

    return {
      roundNumber,
      timestamp,
      teamResults,
      totalDemand: totals.totalDemand,
      totalSold,
      totalRevenue: totals.totalRevenue,
      totalCost: totals.totalCost,
      totalProfit: totals.totalProfit,
      totalPoints: teamResults.reduce((sum, entry) => sum + Number(entry?.points ?? 0), 0),
      avgPrice: totalSold > 0 ? weightedPriceSum / totalSold : 0
    };
  };

  const getNextRoundNumber = () => {
    const history = roundHistoryRef.current ?? [];
    const maxRound = history.reduce((max: number, entry: any) => {
      const key = extractRoundKey(entry);
      if (key === null) return max;
      return Math.max(max, key);
    }, 0);
    return maxRound + 1;
  };

  const applyServerSnapshot = React.useCallback((state: GameState) => {
    if (!state) return;
    const fareCodes = (state.fares || []).map(f => f.code);
    const normalizedTeams = (state.teams || []).map(team => ({
      ...team,
      decisions: {
        price: team.decisions?.price ?? 500,
        buy: fareCodes.reduce((acc, code) => ({ ...acc, [code]: team.decisions?.buy?.[code] ?? 0 }), {} as Record<string, number>),
        fixSeatsPurchased: team.decisions?.fixSeatsPurchased ?? 0,
        fixSeatsAllocated: team.decisions?.fixSeatsAllocated,
        poolingAllocation: team.decisions?.poolingAllocation ?? 0,
        fixSeatsRequested: team.decisions?.fixSeatsRequested ?? team.decisions?.fixSeatsPurchased ?? 0,
        fixSeatBidPrice: team.decisions?.fixSeatBidPrice ?? null,
        fixSeatClearingPrice: team.decisions?.fixSeatClearingPrice ?? null
      }
    }));
    const normalizedState: GameState = { ...state, teams: normalizedTeams };
    setGameState(normalizedState);

    const sid = socketIdRef.current;
    if (sid) {
      const myTeam = normalizedTeams.find(team => team.id === sid);
      if (myTeam) {
        setCurrentTeam(myTeam);
      }
    }
  }, [setGameState, setCurrentTeam]);

  const requestServerResync = React.useCallback(() => {
    const s = socket;
    if (!s) return;
    const token = localStorage.getItem('apxo_resume_token');
    if (token) {
      s.emit('resumeTeam', token, () => {});
    }
  }, [socket]);

  const processRoundStarted = React.useCallback((roundNumber: number) => {
    console.log('Round started:', roundNumber);
    setRoundResults(null);
  }, []);

  const processRoundEnded = React.useCallback((data: RoundEndedPayload) => {
    const results = Array.isArray(data?.roundResults) ? data.roundResults : [];
    const resolvedRoundNumber = resolveIncomingRoundNumber(data);
    const fallbackRoundNumber = getNextRoundNumber();
    const finalRoundNumber = Number.isFinite(resolvedRoundNumber) ? (resolvedRoundNumber as number) : fallbackRoundNumber;
    const timestamp = data?.timestamp ?? new Date().toISOString();

    console.log('Round ended:', finalRoundNumber);
    setRoundResults(results);

    if (results.length > 0) {
      const roundEntry = buildRoundHistoryEntry(finalRoundNumber, results, timestamp);
      setRoundHistory(prev => mergeRoundHistoryEntries(prev, [roundEntry], true));
      setAnalyticsData(prev => {
        const existingHistory = Array.isArray(prev?.roundHistory) ? prev.roundHistory : [];
        const mergedHistory = mergeRoundHistoryEntries(existingHistory, [roundEntry], true);
        return {
          ...(prev ?? {}),
          roundHistory: mergedHistory,
          latestRoundNumber: finalRoundNumber,
          latestUpdatedAt: timestamp
        };
      });
    }
  }, [setRoundResults, setRoundHistory, setAnalyticsData]);

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
      socketIdRef.current = newSocket.id;
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
      socketIdRef.current = null;
      console.log('Disconnected from server');
    });

    // Listen for game state updates
    newSocket.on('gameState', (state: GameState) => {
      if (practiceRef.current?.running) {
        const pendingState = pendingServerSyncRef.current ?? {};
        pendingServerSyncRef.current = {
          ...pendingState,
          gameState: state
        };
        return;
      }
      console.log('Game state updated:', state);
      applyServerSnapshot(state);
    });

    // Also listen for gameStateUpdate events (broadcasted updates)
    newSocket.on('gameStateUpdate', (state: GameState) => {
      if (practiceRef.current?.running) {
        const pendingState = pendingServerSyncRef.current ?? {};
        pendingServerSyncRef.current = {
          ...pendingState,
          gameState: state
        };
        return;
      }
      console.log('Game state broadcast updated:', state);
      applyServerSnapshot(state);
    });

    const handlePhaseStarted = (phase: string) => {
      if (practiceRef.current?.running) {
        const pendingState = pendingServerSyncRef.current ?? {};
        const nextSummary = phase === 'prePurchase' ? null : (pendingState.allocationSummary ?? null);
        pendingServerSyncRef.current = {
          ...pendingState,
          allocationSummary: nextSummary
        };
        return;
      }
      if (phase === 'prePurchase') {
        setAllocationSummary(null);
      }
    };
    newSocket.on('phaseStarted', handlePhaseStarted);

    const handleFixSeatsAllocated = (result: AllocationSummary) => {
      if (practiceRef.current?.running) {
        const pendingState = pendingServerSyncRef.current ?? {};
        pendingServerSyncRef.current = {
          ...pendingState,
          allocationSummary: result
        };
        return;
      }
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
      if (practiceRef.current?.running) {
        const pendingState = pendingServerSyncRef.current ?? {};
        pendingServerSyncRef.current = {
          ...pendingState,
          roundStarted: roundNumber
        };
        return;
      }
      processRoundStarted(roundNumber);
      // Note: gameState.isActive will be updated via gameStateUpdate event
    });

    newSocket.on('roundEnded', (data: RoundEndedPayload) => {
      if (practiceRef.current?.running) {
        const pendingState = pendingServerSyncRef.current ?? {};
        pendingServerSyncRef.current = {
          ...pendingState,
          roundEnded: data
        };
        return;
      }
      processRoundEnded(data);
      // Note: gameState.isActive will be updated via gameStateUpdate event
    });

    // Listen for leaderboard
    newSocket.on('leaderboard', (board: Array<{ name: string; revenue: number; profit?: number }>) => {
      if (practiceRef.current?.running) {
        const pendingState = pendingServerSyncRef.current ?? {};
        pendingServerSyncRef.current = {
          ...pendingState,
          leaderboard: board
        };
        return;
      }
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
      if (!isAdminRef.current) {
        console.warn('Ignoring analytics payload for non-admin client');
        return;
      }
      const incomingHistory = Array.isArray(data?.roundHistory) ? data.roundHistory : [];
      const mergedHistory = mergeRoundHistoryEntries(roundHistoryRef.current ?? [], incomingHistory, true);
      setRoundHistory(mergedHistory);
      setAnalyticsData({
        ...data,
        roundHistory: mergedHistory
      });
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
      // Reset local state for current game (keep historical analytics data)
      setGameState(prev => ({
        ...prev,
        teams: [],
        currentRound: 0,
        isActive: false
      }));
      setCurrentTeam(null);
      setRoundResults(null);
      setLeaderboard(null);
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
  }, [applyServerSnapshot, processRoundEnded, processRoundStarted]);

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

    const aiCount = Math.max(2, Math.min(6, Number(config?.aiCount) || 3));
    setPractice({ running: true, rounds: 1, aiCount });
    practiceRef.current = { running: true, rounds: 1, aiCount };
    setAllocationSummary(null);
    // Snapshot live state
    liveGameSnapshot.current = gameState;
    pendingServerSyncRef.current = null;

    // Build randomized practice state mirroring server
    const rnd = (min: number, max: number) => Math.random() * (max - min) + min;
    const irnd = (min: number, max: number) => Math.floor(rnd(min, max + 1));

    const totalAircraftSeats = irnd(600, 1400);
    const perTeamCount = aiCount + 1;
    const fixSeatPrice = irnd(50, 80);
    const airlinePriceMin = defaultConfig?.airline?.P_min ?? 80;
    const airlinePriceMax = defaultConfig?.airline?.P_max ?? 400;
    const fixSeatMinBid = Math.max(fixSeatPrice, airlinePriceMin);
    const fixSeatShare = Math.min(0.95, Math.max(0, perTeamCount * 0.08));
    const poolingCost = irnd(70, 120);
    const perTeamBudget = irnd(15000, 40000);
    const departureDate = new Date(Date.now() + 365 * MS_PER_DAY);
    const baselineCapacity = Math.max(1, defaultConfig?.airline?.C_total ?? totalAircraftSeats);
    const demandVolatility = Number(rnd(0.05, 0.2).toFixed(2));
    const priceElasticity = Number((-rnd(0.9, 2.7)).toFixed(2));
    const crossElasticity = Number(rnd(0.0, 1.0).toFixed(2));
    const marketConcentration = Number(rnd(0.5, 0.9).toFixed(2));
    const horizonDays = Math.max(1, Math.ceil((departureDate.getTime() - Date.now()) / MS_PER_DAY));
    const defaultDemandCurve = Array.isArray(defaultConfig?.market?.D_base) && defaultConfig.market.D_base.length > 0
      ? defaultConfig.market.D_base
      : Array.from({ length: 12 }, () => 20);
    const demandPlan = buildPracticeDemandSchedule({
      horizonDays,
      totalCapacity: totalAircraftSeats,
      baselineCapacity,
      demandCurve: defaultDemandCurve,
    });
    const practiceDemandSchedule = demandPlan.schedule;
    const baseDemand = Math.max(1, demandPlan.average);

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
      baseDemand,
      demandVolatility,
      priceElasticity,
      crossElasticity,
      marketConcentration,
      roundTime: 60, // seconds for pre-purchase
      currentPhase: 'prePurchase',
      phaseTime: 60,
      totalCapacity: totalAircraftSeats,
      totalAircraftSeats,
  totalFixSeats: Math.floor(totalAircraftSeats * fixSeatShare),
  availableFixSeats: Math.floor(totalAircraftSeats * fixSeatShare),
      fixSeatPrice,
  fixSeatShare,
  fixSeatMinBid,
  perTeamBudget,
      airlinePriceMin,
      airlinePriceMax,
  poolingMarketUpdateInterval: 1,
  simulatedWeeksPerUpdate: 7,
  departureDate,
  remainingTime: 0,
  simulatedDaysUntilDeparture: Math.ceil((departureDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  poolingReserveCapacity: Math.floor(totalAircraftSeats * (1 - fixSeatShare)),
  poolingMarket: {
        currentPrice: irnd(100, 220),
        totalPoolingCapacity: Math.floor(totalAircraftSeats * (1 - fixSeatShare)),
        availablePoolingCapacity: Math.floor(totalAircraftSeats * (1 - fixSeatShare)),
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
          const share = Math.max(0, Math.min(0.95, prev.fixSeatShare ?? fixSeatShare));
          const maxFixCapacity = Math.floor((prev.totalAircraftSeats || 1000) * share);
          const budget = Number(prev.perTeamBudget || 0);
          const defaultBid = Number(prev.fixSeatPrice || 60) || 60;
          const minBidPrice = Math.max(
            1,
            Math.round(
              prev.fixSeatMinBid
                ?? Math.max(prev.fixSeatPrice || 0, defaultConfig?.airline?.P_min ?? 80)
            )
          );

          const requests = prev.teams.map(team => {
            const rawRequested = Math.max(0, Math.floor(Number(team.decisions?.fixSeatsPurchased || 0)));
            const rawBid = team.decisions?.fixSeatBidPrice ?? defaultBid;
            const bidPrice = Number.isFinite(Number(rawBid)) && Number(rawBid) > 0 ? Math.round(Number(rawBid)) : defaultBid;
            const meetsMinBid = bidPrice >= minBidPrice;
            let capped = rawRequested;
            if (!meetsMinBid) {
              capped = 0;
            } else if (budget > 0 && bidPrice > 0) {
              capped = Math.min(capped, Math.floor(budget / bidPrice));
            }
            return {
              team,
              teamId: team.id,
              requestedOriginal: rawRequested,
              requested: Math.max(0, capped),
              capped: Math.max(0, capped),
              bidPrice,
              meetsMinBid
            };
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
          const allocationMap = new Map<string, { allocated: number; price: number; requested: number; requestedOriginal: number; meetsMinBid: boolean }>();

          for (const [price, group] of grouped.entries()) {
            if (remaining <= 0) {
              group.forEach(req => allocationMap.set(req.teamId, { allocated: 0, price, requested: req.capped, requestedOriginal: req.requestedOriginal, meetsMinBid: req.meetsMinBid }));
              continue;
            }
            const totalGroupRequested = group.reduce((sum, req) => sum + req.capped, 0);
            if (totalGroupRequested <= remaining) {
              for (const req of group) {
                allocationMap.set(req.teamId, { allocated: req.capped, price, requested: req.capped, requestedOriginal: req.requestedOriginal, meetsMinBid: req.meetsMinBid });
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
              allocationMap.set(item.req.teamId, {
                allocated: item.base + extra,
                price,
                requested: item.req.capped,
                requestedOriginal: item.req.requestedOriginal,
                meetsMinBid: item.req.meetsMinBid
              });
            }
            remaining = 0;
          }

          const requestLookup = new Map(requests.map(req => [req.teamId, req]));
          const teams = prev.teams.map(t => {
            const alloc = allocationMap.get(t.id);
            const allocated = alloc ? alloc.allocated : 0;
            const bidPrice = Number.isFinite(Number(t.decisions?.fixSeatBidPrice)) && Number(t.decisions?.fixSeatBidPrice) > 0
              ? Math.round(Number(t.decisions?.fixSeatBidPrice))
              : defaultBid;
            const meetsMin = alloc ? alloc.meetsMinBid : (requestLookup.get(t.id)?.meetsMinBid ?? (bidPrice >= minBidPrice));
            const clearingPrice = allocated > 0 && meetsMin ? (alloc ? alloc.price : bidPrice) : null;
            const requestedOriginal = requestLookup.get(t.id)?.requestedOriginal ?? Math.max(0, Math.floor(Number(t.decisions?.fixSeatsPurchased || 0)));
            return {
              ...t,
              decisions: {
                ...t.decisions,
                fixSeatsRequested: requestedOriginal,
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
            const defaultClearingPrice = Number.isFinite(Number(prev.fixSeatPrice))
              ? Math.max(1, Math.round(Number(prev.fixSeatPrice)))
              : Math.max(1, Math.round(fixSeatPrice || 60));
            const initialFixAllocations = teams.map(t => Math.max(0, t.decisions?.fixSeatsAllocated || t.decisions?.fixSeatsPurchased || 0));
            const initialPoolAllocations = teams.map(t => Math.max(0, Math.round(totalAircraftSeats * ((t.decisions?.poolingAllocation || 0) / 100))));
            const initialCostPerTeam = teams.map((team, index) => {
              const clearing = Number.isFinite(Number(team.decisions?.fixSeatClearingPrice)) && Number(team.decisions?.fixSeatClearingPrice) > 0
                ? Math.round(Number(team.decisions?.fixSeatClearingPrice))
                : defaultClearingPrice;
              return initialFixAllocations[index] * clearing;
            });

            const scheduleForSim = practiceDemandSchedule.length ? practiceDemandSchedule.slice() : [];
            simDataRef.current = {
              remainingFix: initialFixAllocations.slice(),
              remainingPool: initialPoolAllocations.slice(),
              sold: teams.map(() => 0),
              poolUsed: teams.map(() => 0),
              revenue: teams.map(() => 0),
              cost: initialCostPerTeam.slice(),
              demand: teams.map(() => 0),
              initialFix: initialFixAllocations,
              initialPool: initialPoolAllocations,
              insolvent: teams.map(() => false),
              demandSchedule: scheduleForSim,
              dayIndex: 0,
              totalDays: scheduleForSim.length || Math.max(1, daysToDeparture)
            };
            startSimInterval();
          }, 0);

          const allocationsForSummary = requests.map(req => {
            const alloc = allocationMap.get(req.teamId);
            const allocated = alloc ? alloc.allocated : 0;
            const price = alloc ? alloc.price : req.bidPrice;
            const disqualified = !req.meetsMinBid;
            return {
              teamId: req.teamId,
              teamName: req.team.name,
              requested: req.capped,
              requestedOriginal: req.requestedOriginal,
              bidPrice: req.bidPrice,
              allocated,
              clearingPrice: !disqualified && allocated > 0 ? price : null,
              disqualifiedForLowBid: disqualified,
              minRequiredBid: minBidPrice
            };
          });
          const totalRequested = requests.reduce((sum, req) => sum + req.requestedOriginal, 0);
          const totalAllocated = allocationsForSummary.reduce((sum, entry) => sum + entry.allocated, 0);
          const poolingReserveCapacity = Math.floor((prev.totalAircraftSeats || 1000) * (1 - share));
          setAllocationSummary({
            allocations: allocationsForSummary,
            totalRequested,
            totalAllocated,
            maxFixCapacity,
            poolingReserveCapacity,
            minimumBidPrice: minBidPrice
          });
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

          // Price-dependent demand distribution across teams (softmax around the average price)
          const teams = prev.teams.map(t => ({
            ...t,
            decisions: {
              ...t.decisions,
              price: typeof t.decisions?.price === 'number' ? t.decisions.price : 500
            }
          }));
          // Per-tick matching: manage remaining capacities
          if (!simDataRef.current || (simDataRef.current.remainingFix.length !== teams.length)) {
            // Fallback init if values were not provided
            const seatsForState = Math.max(1, Number(prev.totalAircraftSeats || totalAircraftSeats || 1000));
            const defaultClearing = Number.isFinite(Number(prev.fixSeatPrice))
              ? Math.max(1, Math.round(Number(prev.fixSeatPrice)))
              : Math.max(1, Math.round(fixSeatPrice || 60));
            const initialFix = teams.map(t => Math.max(0, t.decisions?.fixSeatsAllocated || t.decisions?.fixSeatsPurchased || 0));
            const initialPool = teams.map(t => Math.max(0, Math.round(seatsForState * ((t.decisions?.poolingAllocation || 0) / 100))));
            const initialCost = teams.map((team, index) => {
              const clearing = Number.isFinite(Number(team.decisions?.fixSeatClearingPrice)) && Number(team.decisions?.fixSeatClearingPrice) > 0
                ? Math.round(Number(team.decisions?.fixSeatClearingPrice))
                : defaultClearing;
              return initialFix[index] * clearing;
            });
            const fallbackSchedule = practiceDemandSchedule.length ? practiceDemandSchedule.slice() : [];
            simDataRef.current = {
              remainingFix: initialFix.slice(),
              remainingPool: initialPool.slice(),
              sold: teams.map(() => 0),
              poolUsed: teams.map(() => 0),
              revenue: teams.map(() => 0),
              cost: initialCost.slice(),
              demand: teams.map(() => 0),
              initialFix,
              initialPool,
              insolvent: teams.map(() => false),
              demandSchedule: fallbackSchedule,
              dayIndex: 0,
              totalDays: fallbackSchedule.length || Math.max(1, previousDays)
            };
          }
          const data = simDataRef.current!;

          const schedule = data.demandSchedule && data.demandSchedule.length > 0
            ? data.demandSchedule
            : (practiceDemandSchedule.length ? practiceDemandSchedule : []);
          const scheduleLength = schedule.length;
          const currentDayIndex = Math.min(data.dayIndex ?? 0, scheduleLength > 0 ? scheduleLength - 1 : 0);
          let baseD = scheduleLength > 0 ? (schedule[currentDayIndex] ?? 0) : 0;
          if (scheduleLength === 0) {
            baseD = Math.max(10, prev.baseDemand || 100);
          }
          const volatility = Math.abs(prev.demandVolatility ?? 0.1);
          const variation = scheduleLength > 0 ? Math.min(0.5, Math.max(0.02, volatility)) : 0.4;
          const noiseMultiplier = 1 + ((Math.random() * 2 - 1) * variation);
          const demandToday = Math.max(0, Math.round(baseD * noiseMultiplier));
          if (scheduleLength > 0) {
            data.dayIndex = Math.min(scheduleLength, currentDayIndex + 1);
          }

          const avgPrice = teams.reduce((s, t) => s + (t.decisions.price || 500), 0) / Math.max(1, teams.length);
          const elasticity = Math.abs(prev.priceElasticity || 1); // typically 0.9..2.7 from the practice setup
          const k = Math.min(0.08, Math.max(0.008, elasticity / 50)); // 0.018..0.054
          const weights = teams.map(t => Math.exp(-k * ((t.decisions.price || 500) - avgPrice)));
          const sumW = weights.reduce((a, b) => a + b, 0) || 1;
          const demandPerTeam = teams.map((_, i) => Math.max(0, Math.round(demandToday * (weights[i] / sumW))));

          // Pricing before consumption: use pre-tick available pooling supply and remaining fixed seats
          const remainingFixBefore = data.remainingFix.slice();
          const remainingPoolBefore = data.remainingPool.slice();
          const poolingDemand = demandPerTeam.reduce((s, d, i) => s + Math.max(0, d - remainingFixBefore[i]), 0);
          const poolingOfferedBefore = remainingPoolBefore.reduce((a, b) => a + b, 0);

          // Pool price dynamics with mean reversion and light noise
          const share = Math.max(0, Math.min(0.95, prev.fixSeatShare ?? fixSeatShare));
          const pm = prev.poolingMarket || {
            currentPrice: 150,
            totalPoolingCapacity: Math.floor((prev.totalAircraftSeats || 1000) * (1 - share)),
            availablePoolingCapacity: Math.floor((prev.totalAircraftSeats || 1000) * (1 - share)),
            offeredPoolingCapacity: 0,
            currentDemand: 0,
            lastUpdate: new Date().toISOString(),
            priceHistory: [] as any[]
          };
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

          const budget = Number(prev.perTeamBudget || 0);

          // Matching: consume fixed seats first, then pooling
          teams.forEach((team, i) => {
            let need = demandPerTeam[i];
            const serveFix = Math.min(need, data.remainingFix[i]);
            data.remainingFix[i] = Math.max(0, data.remainingFix[i] - serveFix);
            need -= serveFix;

            const price = Math.max(1, Number(team.decisions?.price ?? 500));
            let servePool = Math.min(need, data.remainingPool[i]);
            if (servePool > 0 && price < newPrice && budget > 0 && !(data.insolvent?.[i])) {
              const currentProfit = (data.revenue[i] ?? 0) - (data.cost[i] ?? 0);
              const profitAfterFix = currentProfit + (serveFix * price);
              const margin = price - newPrice;
              if (margin < 0) {
                const maxAdditionalLoss = budget + profitAfterFix;
                if (maxAdditionalLoss <= 0) {
                  servePool = 0;
                } else {
                  const maxSeatsByBudget = Math.floor(maxAdditionalLoss / (-margin));
                  servePool = Math.min(servePool, Math.max(0, maxSeatsByBudget));
                }
              }
            }

            data.remainingPool[i] = Math.max(0, data.remainingPool[i] - servePool);
            need -= servePool;

            const seatsSold = serveFix + servePool;
            data.sold[i] = Math.max(0, (data.sold[i] ?? 0) + seatsSold);
            data.poolUsed[i] = Math.max(0, (data.poolUsed[i] ?? 0) + servePool);
            data.demand[i] = Math.max(0, (data.demand[i] ?? 0) + demandPerTeam[i]);

            data.revenue[i] = Math.max(0, (data.revenue[i] ?? 0) + seatsSold * price);
            data.cost[i] = Math.max(0, (data.cost[i] ?? 0) + servePool * newPrice);

            if ((data.revenue[i] ?? 0) - (data.cost[i] ?? 0) < MIN_PROFIT_LIMIT) {
              data.cost[i] = (data.revenue[i] ?? 0) - MIN_PROFIT_LIMIT;
            }

            if (budget > 0) {
              const profitForecast = (data.revenue[i] ?? 0) - (data.cost[i] ?? 0);
              if (profitForecast < 0 && Math.abs(profitForecast) > budget) {
                data.insolvent[i] = true;
              }
            }
          });

          const poolingOfferedAfter = data.remainingPool.reduce((a, b) => a + b, 0);
          const totalPoolingCapacity = Math.floor((prev.totalAircraftSeats || 1000) * (1 - share));
          const availablePoolingCapacity = Math.max(0, Math.min(totalPoolingCapacity, poolingOfferedAfter));
          const updatedPM = {
            ...pm,
            currentPrice: newPrice,
            offeredPoolingCapacity: poolingOfferedAfter,
            totalPoolingCapacity,
            availablePoolingCapacity,
            currentDemand: poolingDemand,
            lastUpdate: new Date().toISOString(),
            priceHistory
          };

          const perTeamSimState = teams.reduce<Record<string, any>>((acc, team, index) => {
            acc[team.id] = {
              fixRemaining: Math.max(0, data.remainingFix[index] ?? 0),
              poolRemaining: Math.max(0, data.remainingPool[index] ?? 0),
              sold: Math.max(0, data.sold[index] ?? 0),
              poolUsed: Math.max(0, data.poolUsed[index] ?? 0),
              demand: Math.max(0, data.demand[index] ?? 0),
              initialFix: Math.max(0, data.initialFix?.[index] ?? 0),
              initialPool: Math.max(0, data.initialPool?.[index] ?? 0),
              revenue: Math.max(0, data.revenue[index] ?? 0),
              cost: Math.max(0, data.cost[index] ?? 0),
              insolvent: !!data.insolvent?.[index]
            };
            return acc;
          }, {});

          if (countdownSeconds <= 0) {
            clearInterval(simTimerRef.current);
            const priceHistoryForAvg = Array.isArray(updatedPM.priceHistory) ? updatedPM.priceHistory : [];
            const avgPoolingUnit = priceHistoryForAvg.length > 0
              ? Math.round(priceHistoryForAvg.reduce((sum, entry) => sum + (entry.price || 0), 0) / priceHistoryForAvg.length)
              : Math.round(newPrice);
            const defaultClearing = Number.isFinite(Number(prev.fixSeatPrice))
              ? Math.max(1, Math.round(Number(prev.fixSeatPrice)))
              : Math.max(1, Math.round(fixSeatPrice || 60));

            const finalResults = teams.map((team, index) => {
              const sim = perTeamSimState[team.id] || {};
              const price = Math.max(1, Number(team.decisions?.price ?? 500));
              const sold = Math.max(0, Math.round(sim.sold ?? data.sold[index] ?? 0));
              const poolUsed = Math.max(0, Math.round(sim.poolUsed ?? data.poolUsed[index] ?? 0));
              const demandTotal = Math.max(0, Math.round(sim.demand ?? data.demand[index] ?? 0));
              const initialFix = Math.max(0, Math.round(sim.initialFix ?? data.initialFix?.[index] ?? (team.decisions?.fixSeatsAllocated || team.decisions?.fixSeatsPurchased || 0)));
              const initialPool = Math.max(0, Math.round(sim.initialPool ?? data.initialPool?.[index] ?? Math.round((prev.totalAircraftSeats || totalAircraftSeats || 1000) * ((team.decisions?.poolingAllocation || 0) / 100))));
              const clearing = Number.isFinite(Number(team.decisions?.fixSeatClearingPrice)) && Number(team.decisions?.fixSeatClearingPrice) > 0
                ? Math.round(Number(team.decisions?.fixSeatClearingPrice))
                : defaultClearing;
              const revenue = Math.round(sim.revenue ?? data.revenue[index] ?? sold * price);
              const trackedCost = sim.cost ?? data.cost[index];
              const fallbackCost = (initialFix * clearing) + (poolUsed * avgPoolingUnit);
              let cost = Math.round(Number.isFinite(Number(trackedCost)) ? Number(trackedCost) : fallbackCost);
              let profit = Math.round(revenue - cost);
              if (profit < MIN_PROFIT_LIMIT) {
                profit = MIN_PROFIT_LIMIT;
                cost = Math.round(revenue - profit);
              }
              const unsold = Math.max(0, demandTotal - sold);
              const insolventFlag = sim.insolvent ?? (budget > 0 && profit < 0 && Math.abs(profit) > budget);
              return {
                teamId: team.id,
                sold,
                revenue,
                cost,
                profit,
                unsold,
                demand: demandTotal,
                avgPrice: price,
                capacity: initialFix + initialPool,
                poolUsed,
                insolvent: !!insolventFlag
              };
            });

            const totalSold = finalResults.reduce((sum, entry) => sum + entry.sold, 0) || 1;
            const resultsWithShare = finalResults.map(entry => ({
              ...entry,
              marketShare: Math.round((entry.sold / totalSold) * 100) / 100
            }));

            setRoundResults(resultsWithShare);

            return {
              ...prev,
              isActive: false,
              simulatedDaysUntilDeparture: 0,
              countdownSeconds: 0,
              poolingMarket: updatedPM,
              simState: { perTeam: perTeamSimState, returnedDemandRemaining: 0 }
            } as GameState;
          }

          return {
            ...prev,
            simulatedDaysUntilDeparture: daysRemaining,
            countdownSeconds,
            poolingMarket: updatedPM,
            simState: { perTeam: perTeamSimState, returnedDemandRemaining: 0 }
          } as GameState;
        });
      }, 1000);
    };
  };

  const stopPracticeMode = () => {
    if (preTimerRef.current) clearInterval(preTimerRef.current);
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simDataRef.current = null;
    setPractice({ running: false });
    practiceRef.current = { running: false };

    const pending = pendingServerSyncRef.current;
    pendingServerSyncRef.current = null;

    let appliedPendingState = false;
    if (pending?.gameState) {
      applyServerSnapshot(pending.gameState);
      appliedPendingState = true;
    } else if (liveGameSnapshot.current) {
      applyServerSnapshot(liveGameSnapshot.current);
    }
    liveGameSnapshot.current = null;

    if (pending && Object.prototype.hasOwnProperty.call(pending, 'roundStarted')) {
      const roundNumber = pending.roundStarted ?? 0;
      processRoundStarted(roundNumber);
    } else if (!(pending && Object.prototype.hasOwnProperty.call(pending, 'roundEnded'))) {
      setRoundResults(null);
    }

    if (pending && Object.prototype.hasOwnProperty.call(pending, 'roundEnded') && pending.roundEnded) {
      processRoundEnded(pending.roundEnded);
    }

    if (pending && Object.prototype.hasOwnProperty.call(pending, 'allocationSummary')) {
      setAllocationSummary(pending.allocationSummary ?? null);
    }

    if (pending && Object.prototype.hasOwnProperty.call(pending, 'leaderboard')) {
      setLeaderboard(pending.leaderboard ?? null);
    }

    if (!appliedPendingState) {
      requestServerResync();
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
    if (!isAdminRef.current) {
      console.warn('Analytics request blocked: admin access required');
      return;
    }
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
