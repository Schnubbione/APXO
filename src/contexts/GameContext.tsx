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

  // Actions
  registerTeam: (name: string) => void;
  loginAsAdmin: (password: string) => void;
  updateGameSettings: (settings: Partial<GameState>) => void;
  updateTeamDecision: (decision: { price?: number; buy?: Record<string, number> }) => void;
  startRound: () => void;
  endRound: () => void;
  getLeaderboard: () => void;
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

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    console.log('Connecting to server...');

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Listen for game state updates
    newSocket.on('gameState', (state: GameState) => {
      console.log('Game state updated:', state);
      setGameState(state);
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

  const value: GameContextType = {
    socket,
    gameState,
    currentTeam,
    isAdmin,
    roundResults,
    leaderboard,
    registerTeam,
    loginAsAdmin,
    updateGameSettings,
    updateTeamDecision,
    startRound,
    endRound,
    getLeaderboard
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};
