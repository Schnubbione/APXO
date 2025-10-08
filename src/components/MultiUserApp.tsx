import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../contexts/GameContext';
import { TeamRegistration } from './MultiUserTeamRegistration';
import { AdminLogin } from './AdminLogin';
import AdminPanel from './AdminPanel';
import RoundTimer from './RoundTimer';
import Tutorial from './Tutorial';
import TutorialTour from './TutorialTour';
import StreakCounter from './StreakCounter';
import MotivationalMessages from './MotivationalMessages';
import LiveCompetition from './LiveCompetition';
import SoundEffects from './SoundEffects';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { Users, Award, Settings, MapPin, Sun, Camera, Compass, Anchor, Mountain, Tent, Binoculars, Map, Navigation, Waves, Snowflake, Eye, Star, Coffee } from 'lucide-react';
import { useToast } from './ui/toast';

const TEAM_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

const TOURIST_ICONS = [Sun, Camera, Compass, Anchor, MapPin, Mountain, Tent, Binoculars, Map, Navigation, Waves, Snowflake, Eye, Star, Coffee];

type AllocationEntry = {
  teamId: string;
  teamName: string;
  requested: number;
  bidPrice: number;
  allocated: number;
  clearingPrice: number | null;
};

// Function to get a consistent icon for each team based on team name
const getTeamIconByName = (teamName: string) => {
  const iconIndex = teamName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % TOURIST_ICONS.length;
  return TOURIST_ICONS[iconIndex];
};

export const MultiUserApp: React.FC = () => {
  const {
  isConnected,
  isReconnecting,
    gameState,
    currentTeam,
    isAdmin,
    roundResults,
    leaderboard,
  roundHistory,
    allocationSummary,
  lastError,
  clearLastError,
  practice,
    updateTeamDecision,
    updateGameSettings,
    startPrePurchasePhase,
    startSimulationPhase,
    endRound,
  startPracticeMode,
  stopPracticeMode,
    getLeaderboard,
    getAnalytics,
    resetAllData,
    resetCurrentGame,
    tutorialActive,
    tutorialStep,
    startTutorial,
    skipTutorial,
    setTutorialStep,
    completeTutorial,
  logoutAsAdmin
  } = useGame();

  const [showTutorial, setShowTutorial] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [soundEffect, setSoundEffect] = useState<'achievement' | 'roundStart' | 'roundEnd' | 'warning' | 'success' | 'error' | undefined>();
  const [initialPriceSet, setInitialPriceSet] = useState(false);
  const [tempPrice, setTempPrice] = useState(199);
  const [bidPriceInput, setBidPriceInput] = useState('');
  const [bidQuantityInput, setBidQuantityInput] = useState('');
  // Practice Overlay removed: practice runs integrated via context
  const { toast } = useToast();
  const allocationToastRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (lastError) {
      toast({ variant: 'destructive', title: 'Action failed', description: lastError });
      clearLastError();
    }
  }, [lastError]);

  React.useEffect(() => {
    if (!allocationSummary || !currentTeam) {
      if (!allocationSummary) {
        allocationToastRef.current = null;
      }
      return;
    }

    const allocationForToast = allocationSummary.allocations.find(a => a.teamId === currentTeam.id);
    if (!allocationForToast) return;

    const toastKey = `${allocationForToast.teamId}:${allocationForToast.allocated}:${allocationForToast.clearingPrice ?? 'na'}`;
    if (allocationToastRef.current === toastKey) return;
    allocationToastRef.current = toastKey;

    const clearing = allocationForToast.clearingPrice ?? gameState.fixSeatPrice;
    toast({
      title: 'Fixed seats allocated',
      description: `Your team received ${allocationForToast.allocated} fixed seats${clearing ? ` at a clearing price of €${clearing}` : ''}.`
    });
  }, [allocationSummary, currentTeam, toast, gameState.fixSeatPrice]);

  const sortedAllocations = React.useMemo<AllocationEntry[]>(() => {
    if (!allocationSummary) return [];
    return [...allocationSummary.allocations].sort((a, b) => {
      if (b.allocated !== a.allocated) return b.allocated - a.allocated;
      return a.teamName.localeCompare(b.teamName);
    });
  }, [allocationSummary]);

  const myAllocation = React.useMemo(() => {
    if (!allocationSummary || !currentTeam) return null;
    return allocationSummary.allocations.find(a => a.teamId === currentTeam.id) || null;
  }, [allocationSummary, currentTeam]);

  const mySimState = React.useMemo(() => {
    if (!currentTeam) return null;
    return gameState.simState?.perTeam?.[currentTeam.id] ?? null;
  }, [gameState.simState, currentTeam]);

  const poolSoldSoFar = Math.max(0, mySimState?.poolUsed ?? 0);
  const fixAllocatedTotal = Math.max(0, mySimState?.initialFix ?? (currentTeam?.decisions?.fixSeatsAllocated ?? 0));

  useEffect(() => {
    if (!currentTeam) {
      setBidPriceInput('');
      setBidQuantityInput('');
      return;
    }

    const nextBidPrice = currentTeam.decisions.fixSeatBidPrice && currentTeam.decisions.fixSeatBidPrice > 0
      ? String(currentTeam.decisions.fixSeatBidPrice)
      : '';
    setBidPriceInput(prev => (prev === nextBidPrice ? prev : nextBidPrice));

    const requested = currentTeam.decisions.fixSeatsRequested ?? currentTeam.decisions.fixSeatsPurchased;
    const nextQuantity = requested && requested > 0 ? String(requested) : '';
    setBidQuantityInput(prev => (prev === nextQuantity ? prev : nextQuantity));
  }, [
    currentTeam?.id,
    currentTeam?.decisions.fixSeatBidPrice,
    currentTeam?.decisions.fixSeatsRequested,
    currentTeam?.decisions.fixSeatsPurchased
  ]);

  const [priceSliderValue, setPriceSliderValue] = useState<number>(() => (
    typeof currentTeam?.decisions?.price === 'number' ? currentTeam.decisions.price : 0
  ));

  useEffect(() => {
    if (typeof currentTeam?.decisions?.price === 'number') {
      setPriceSliderValue(currentTeam.decisions.price);
    }
  }, [currentTeam?.decisions?.price]);

  const priceMin = 50;
  const priceMax = 500;

  const priceUpdateTimer = useRef<number | null>(null);

  const priceHistoryData = React.useMemo(() => {
    const history = gameState.poolingMarket?.priceHistory ?? [];
    return history.slice(-40).map((entry, index) => {
      const timestamp = entry.timestamp ? new Date(entry.timestamp) : null;
      return {
        index,
        label: timestamp ? timestamp.toLocaleTimeString('de-DE', { minute: '2-digit', second: '2-digit' }) : `T${index + 1}`,
        price: entry.price
      };
    });
  }, [gameState.poolingMarket?.priceHistory]);

  useEffect(() => {
    return () => {
      if (priceUpdateTimer.current) {
        window.clearTimeout(priceUpdateTimer.current);
      }
    };
  }, []);

  const currentRevenue = Math.round(mySimState?.revenue ?? 0);
  const seatsSoldSoFar = Math.max(0, mySimState?.sold ?? 0);
  const poolingPrice = Math.round(gameState.poolingMarket?.currentPrice ?? 0);
  const daysToDeparture = Math.max(0, Number(gameState.simulatedDaysUntilDeparture ?? 0));
  const remainingFixSeats = Math.max(
    0,
    mySimState?.fixRemaining
      ?? currentTeam?.decisions?.fixSeatsAllocated
      ?? currentTeam?.decisions?.fixSeatsPurchased
      ?? 0
  );
  const fixedSeatClearingPrice = (() => {
    if (myAllocation?.clearingPrice) return myAllocation.clearingPrice;
    const decisionPrice = currentTeam?.decisions?.fixSeatClearingPrice;
    if (typeof decisionPrice === 'number' && decisionPrice > 0) return decisionPrice;
    if (allocationSummary && myAllocation) {
      return myAllocation.clearingPrice ?? gameState.fixSeatPrice;
    }
    return gameState.fixSeatPrice;
  })();

  // Play sound effects for game events
  useEffect(() => {
    if (gameState.isActive && !prevIsActive) {
      setSoundEffect('roundStart');
    } else if (!gameState.isActive && prevIsActive) {
      setSoundEffect('roundEnd');
    }
  }, [gameState.isActive]);

  const prevIsActive = useRef(gameState.isActive);
  useEffect(() => {
    prevIsActive.current = gameState.isActive;
  });

  // Debug: Log state changes
  React.useEffect(() => {
    console.log('App state:', { currentTeam: currentTeam?.name, isAdmin, showAdminLogin });
  }, [currentTeam, isAdmin, showAdminLogin]);

  // Startansicht: Join the Simulation (kein Auto-Tutorial)

  // Get leaderboard when round ends
  useEffect(() => {
    if (roundResults) {
      getLeaderboard();
    }
  }, [roundResults, getLeaderboard]);

  // Warn before leaving page while a game is active
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (gameState.isActive) {
        e.preventDefault();
        e.returnValue = 'A game is currently running. If you leave now, you cannot rejoin until it ends. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [gameState.isActive]);

  // Reset tutorial when not active
  useEffect(() => {
    if (!tutorialActive && tutorialStep !== 0) {
      console.log('Resetting tutorial step to 0');
      // Note: We don't call the context function here to avoid loops
    }
  }, [tutorialActive, tutorialStep]);

  // 1) Tutorial Modal (nur auf Wunsch)
  if (showTutorial) {
    return <Tutorial
      onStart={() => setShowTutorial(false)}
      onStartTour={() => {
        setShowTutorial(false);
        startTutorial();
      }}
    />;
  }

  // Show interactive tutorial for new users
  if (tutorialActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="flex justify-center pt-8">
          <Button
            variant="outline"
            onClick={() => setShowAdminLogin(true)}
            className="bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700/80 backdrop-blur-sm shadow-lg min-h-[44px]"
            data-tutorial="admin-login"
          >
            Admin Login
          </Button>
        </div>
  <TeamRegistration onShowTutorial={() => setShowTutorial(true)} />
        <TutorialTour
          isActive={tutorialActive}
          onComplete={completeTutorial}
          onSkip={skipTutorial}
          currentStep={tutorialStep}
          onStepChange={(step) => setTutorialStep(step)}
        />
      </div>
    );
  }

  // 2) Explicitly show Admin Login when requested (takes precedence over registration/team views)
  if (showAdminLogin && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="flex justify-center pt-8">
          <Button
            variant="outline"
            onClick={() => setShowAdminLogin(false)}
            className="bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700/80 backdrop-blur-sm shadow-lg min-h-[44px]"
          >
            ← Back to Game
          </Button>
        </div>
        <AdminLogin />
      </div>
    );
  }

  // 3) If not registered and not admin, show registration
  if (!currentTeam && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="flex justify-center pt-8">
          <Button
            variant="outline"
            onClick={() => setShowAdminLogin(true)}
            className="bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700/80 backdrop-blur-sm shadow-lg min-h-[44px]"
            data-tutorial="admin-login"
          >
            Admin Login
          </Button>
        </div>
  <TeamRegistration onShowTutorial={() => setShowTutorial(true)} />
      </div>
    );
  }

  // Admin view
  if (isAdmin) {
    const roundTimeMinutes = Math.max(1, Math.round(gameState.roundTime / 60));
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        {/* Top bar: connection + Admin Logout */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
          <div className={`px-2 py-1 rounded text-xs font-medium ${isConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : isReconnecting ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
            {isConnected ? 'Connected' : (isReconnecting ? 'Reconnecting…' : 'Offline')}
          </div>
          <Button
            variant="outline"
            onClick={() => {
              logoutAsAdmin();
            }}
            className="bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700/80 backdrop-blur-sm shadow-lg min-h-[40px] text-sm"
            title="Logout as Admin"
          >
            ← Logout
          </Button>
        </div>
        <AdminPanel
          baseDemand={gameState.baseDemand}
          setBaseDemand={(v) => updateGameSettings({ baseDemand: v })}
          spread={gameState.spread}
          setSpread={(v) => updateGameSettings({ spread: v })}
          shock={gameState.shock}
          setShock={(v) => updateGameSettings({ shock: v })}
          sharedMarket={gameState.sharedMarket}
          setSharedMarket={(v) => updateGameSettings({ sharedMarket: v })}
          seed={gameState.seed}
          setSeed={(v) => updateGameSettings({ seed: v })}
          roundTime={roundTimeMinutes}
          setRoundTime={(v) => updateGameSettings({ roundTime: v * 60 })}
          poolingMarketUpdateInterval={gameState.poolingMarketUpdateInterval || 15}
          setPoolingMarketUpdateInterval={(v) => updateGameSettings({ poolingMarketUpdateInterval: v })}
          simulatedWeeksPerUpdate={gameState.simulatedWeeksPerUpdate || 2}
          setSimulatedWeeksPerUpdate={(v) => updateGameSettings({ simulatedWeeksPerUpdate: v })}
          totalAircraftSeats={gameState.totalAircraftSeats || 1000}
          setTotalAircraftSeats={(v) => updateGameSettings({ totalAircraftSeats: v })}
          hotelCapacityRatio={gameState.hotelCapacityRatio}
          setHotelCapacityRatio={(v) => updateGameSettings({ hotelCapacityRatio: v })}
          fixSeatPrice={gameState.fixSeatPrice}
          setFixSeatPrice={(v) => updateGameSettings({ fixSeatPrice: v })}
          poolingCost={(gameState as any).poolingCost}
          setPoolingCost={(v) => updateGameSettings({ poolingCost: v })}
          hotelBedCost={gameState.hotelBedCost}
          setHotelBedCost={(v) => updateGameSettings({ hotelBedCost: v })}
          perTeamBudget={(gameState as any).perTeamBudget}
          setPerTeamBudget={(v) => updateGameSettings({ perTeamBudget: v })}
          demandVolatility={gameState.demandVolatility}
          setDemandVolatility={(v) => updateGameSettings({ demandVolatility: v })}
          priceElasticity={gameState.priceElasticity}
          setPriceElasticity={(v) => updateGameSettings({ priceElasticity: v })}
          marketPriceElasticity={(gameState as any).marketPriceElasticity}
          setMarketPriceElasticity={(v) => updateGameSettings({ marketPriceElasticity: v })}
          referencePrice={(gameState as any).referencePrice}
          setReferencePrice={(v) => updateGameSettings({ referencePrice: v })}
          marketConcentration={gameState.marketConcentration}
          setMarketConcentration={(v) => updateGameSettings({ marketConcentration: v })}
          costVolatility={gameState.costVolatility}
          setCostVolatility={(v) => updateGameSettings({ costVolatility: v })}
          crossElasticity={gameState.crossElasticity}
          setCrossElasticity={(v) => updateGameSettings({ crossElasticity: v })}
          isAdmin={true}
          setIsAdmin={() => { /* handled via reload in AdminPanel */ }}
          showAdminPanel={showAdminPanel}
          setShowAdminPanel={setShowAdminPanel}
          gameState={gameState}
          roundHistory={roundHistory}
          leaderboard={leaderboard || []}
          onGetAnalytics={getAnalytics}
          onResetAllData={resetAllData}
          onResetCurrentGame={resetCurrentGame}
        />

        <RoundTimer
          roundTime={roundTimeMinutes}
          isActive={gameState.isActive}
          onTimeUp={endRound}
          currentPhase={gameState.currentPhase}
          remainingTime={gameState.remainingTime}
          simulatedDaysUntilDeparture={(gameState as any).simulatedDaysUntilDeparture}
        />

  <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <header className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <Waves className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Allotment Procurement & Demand Simulation
              </h1>
            </div>
            <div className="flex items-center justify-center gap-4 text-slate-400">
              <span className="text-lg">Admin Control Panel</span>
              <Button
                onClick={() => setShowAdminPanel(true)}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-lg shadow-lg transition-all duration-200"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </header>

          {/* Phase Control */}
          <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm border-slate-600 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
            <CardContent className="pt-6 sm:pt-8">
              <div className="text-center space-y-4">
                <div className="text-2xl font-bold text-white mb-4">
                  Current Phase: {gameState.currentPhase === 'prePurchase' ? 'Pre-Purchase' : gameState.currentPhase === 'simulation' ? 'Simulation' : 'Setup'}
                </div>
                <div className="text-lg text-slate-300 mb-6">
                  {gameState.currentPhase === 'prePurchase' && gameState.isActive ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      ⏰ Pre-purchase phase active. Teams can buy fix seats!
                    </span>
                  ) : gameState.currentPhase === 'simulation' && gameState.isActive ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      🚀 Simulation running. Customers are booking!
                      {(gameState as any).perTeamBudget ? (
                        <span className="ml-3 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-400/30 text-blue-200 text-xs">Budget/Team: €{(gameState as any).perTeamBudget}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-slate-400">Ready to start phases</span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={startPrePurchasePhase}
                    disabled={gameState.isActive || gameState.currentPhase !== 'prePurchase'}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg transition-all duration-200 min-h-[48px]"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                      Start Pre-Purchase Phase
                    </span>
                  </Button>
                  <Button
                    onClick={startSimulationPhase}
                    disabled={gameState.isActive || gameState.currentPhase !== 'simulation'}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg transition-all duration-200 min-h-[48px]"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                      Start Simulation Phase
                    </span>
                  </Button>
                  <Button
                    onClick={endRound}
                    disabled={!gameState.isActive}
                    variant="outline"
                    className="bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700/70 hover:text-white hover:border-slate-500 disabled:opacity-50 font-semibold px-8 py-3 rounded-lg transition-all duration-200 min-h-[48px]"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      End Current Phase
                    </span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Teams Overview */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl text-white">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-indigo-400" />
                </div>
                Registered Teams ({gameState.teams.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {gameState.teams.map((team, index) => {
                  const TeamIcon = getTeamIconByName(team.name);
                  return (
                    <div key={team.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-700/30 rounded-xl border border-slate-600/50 hover:bg-slate-700/50 transition-all duration-200">
                      <div className="flex items-center gap-3 mb-2 sm:mb-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full shadow-lg"
                            style={{ backgroundColor: TEAM_COLORS[index % TEAM_COLORS.length] }}
                          />
                          <div className="p-1 bg-slate-600/50 rounded-lg">
                            <TeamIcon className="w-4 h-4 text-slate-300" />
                          </div>
                        </div>
                        <span className="font-semibold text-white text-lg">{team.name}</span>
                      </div>
                      <div className="text-sm text-slate-300 sm:text-right">
                        Price: <span className="font-mono text-indigo-400">€{team.decisions.price}</span> |
                        Capacity: <span className="font-mono text-green-400">{Object.values(team.decisions.buy).reduce((a, b) => Number(a) + Number(b), 0)} seats</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          {leaderboard && (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 shadow-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl text-white">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Award className="w-5 h-5 text-yellow-400" />
                  </div>
                  High Scores (Revenue)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {leaderboard.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-700/30 to-slate-600/20 border border-slate-600/50 hover:from-slate-700/50 hover:to-slate-600/30 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm">
                          #{index + 1}
                        </div>
                        <span className="font-semibold text-white text-lg">{entry.name}</span>
                      </div>
                      <div className="text-2xl font-bold text-green-400 tabular-nums">€{(entry.revenue ?? 0).toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Team view
  if (currentTeam) {
    const roundTimeMinutes = Math.max(1, Math.round(gameState.roundTime / 60));
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        {/* Top-right: connection badge, actions */}
  <div className="fixed top-4 right-4 z-40 flex gap-2 items-center">
          <div className={`px-2 py-1 rounded text-xs font-medium ${isConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : isReconnecting ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
            {isConnected ? 'Connected' : (isReconnecting ? 'Reconnecting…' : 'Offline')}
          </div>
          {isAdmin && (
            <Button
              onClick={() => setShowAdminPanel(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-lg shadow-lg transition-all duration-200 min-h-[44px] text-sm"
            >
              <Settings className="w-4 h-4 mr-2" />
              Admin
            </Button>
          )}
          {!currentTeam && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdminLogin(true)}
              className="bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700/80 backdrop-blur-sm shadow-lg min-h-[44px] text-sm"
            >
              Admin Login
            </Button>
          )}
          {/* Team logout button */}
          {/* Practice Mode toggle */}
          {practice?.running && (
            <div className="px-2 py-1 rounded text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Practice running
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => (practice?.running ? stopPracticeMode() : startPracticeMode({}))}
            className={`bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700/80 backdrop-blur-sm shadow-lg min-h-[44px] text-sm ${practice?.running ? 'border-red-500/50 hover:bg-red-900/30' : ''}`}
            title={practice?.running ? 'Stop Practice Mode' : 'Start Practice Mode'}
          >
            {practice?.running ? 'Stop Practice' : 'Practice Mode'}
          </Button>
          <TeamLogoutButton />
        </div>

        <RoundTimer
          roundTime={roundTimeMinutes}
          isActive={gameState.isActive}
          onTimeUp={() => {}}
          currentPhase={gameState.currentPhase}
          remainingTime={gameState.remainingTime}
          simulatedDaysUntilDeparture={(gameState as any).simulatedDaysUntilDeparture}
        />

        <AdminPanel
          baseDemand={gameState.baseDemand}
          setBaseDemand={(v) => updateGameSettings({ baseDemand: v })}
          spread={gameState.spread}
          setSpread={(v) => updateGameSettings({ spread: v })}
          shock={gameState.shock}
          setShock={(v) => updateGameSettings({ shock: v })}
          sharedMarket={gameState.sharedMarket}
          setSharedMarket={(v) => updateGameSettings({ sharedMarket: v })}
          seed={gameState.seed}
          setSeed={(v) => updateGameSettings({ seed: v })}
          roundTime={roundTimeMinutes}
          setRoundTime={(v) => updateGameSettings({ roundTime: v * 60 })}
          poolingMarketUpdateInterval={gameState.poolingMarketUpdateInterval || 15}
          setPoolingMarketUpdateInterval={(v) => updateGameSettings({ poolingMarketUpdateInterval: v })}
          simulatedWeeksPerUpdate={gameState.simulatedWeeksPerUpdate || 2}
          setSimulatedWeeksPerUpdate={(v) => updateGameSettings({ simulatedWeeksPerUpdate: v })}
          totalAircraftSeats={gameState.totalAircraftSeats || 1000}
          setTotalAircraftSeats={(v) => updateGameSettings({ totalAircraftSeats: v })}
          hotelCapacityRatio={gameState.hotelCapacityRatio}
          setHotelCapacityRatio={(v) => updateGameSettings({ hotelCapacityRatio: v })}
          fixSeatPrice={gameState.fixSeatPrice}
          setFixSeatPrice={(v) => updateGameSettings({ fixSeatPrice: v })}
          poolingCost={(gameState as any).poolingCost}
          setPoolingCost={(v) => updateGameSettings({ poolingCost: v })}
          hotelBedCost={gameState.hotelBedCost}
          setHotelBedCost={(v) => updateGameSettings({ hotelBedCost: v })}
          perTeamBudget={(gameState as any).perTeamBudget}
          setPerTeamBudget={(v) => updateGameSettings({ perTeamBudget: v })}
          demandVolatility={gameState.demandVolatility}
          setDemandVolatility={(v) => updateGameSettings({ demandVolatility: v })}
          priceElasticity={gameState.priceElasticity}
          setPriceElasticity={(v) => updateGameSettings({ priceElasticity: v })}
          marketPriceElasticity={(gameState as any).marketPriceElasticity}
          setMarketPriceElasticity={(v) => updateGameSettings({ marketPriceElasticity: v })}
          referencePrice={(gameState as any).referencePrice}
          setReferencePrice={(v) => updateGameSettings({ referencePrice: v })}
          marketConcentration={gameState.marketConcentration}
          setMarketConcentration={(v) => updateGameSettings({ marketConcentration: v })}
          costVolatility={gameState.costVolatility}
          setCostVolatility={(v) => updateGameSettings({ costVolatility: v })}
          crossElasticity={gameState.crossElasticity}
          setCrossElasticity={(v) => updateGameSettings({ crossElasticity: v })}
          isAdmin={isAdmin}
          setIsAdmin={() => { /* handled via reload in AdminPanel */ }}
          showAdminPanel={showAdminPanel}
          setShowAdminPanel={setShowAdminPanel}
          gameState={gameState}
          roundHistory={roundHistory}
          leaderboard={leaderboard || []}
          onGetAnalytics={getAnalytics}
          onResetAllData={resetAllData}
          onResetCurrentGame={resetCurrentGame}
        />

  <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <header className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <Waves className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Allotment Procurement & Demand Simulation
              </h1>
            </div>
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div className="flex items-center gap-2">
                {currentTeam && (
                  <div className="p-1 bg-slate-600/50 rounded-lg">
                    {(() => {
                      const TeamIcon = getTeamIconByName(currentTeam.name);
                      return <TeamIcon className="w-4 h-4 text-slate-300" />;
                    })()}
                  </div>
                )}
                <span className="font-medium">Team: {currentTeam.name}</span>
              </div>
            </div>
          </header>

          {/* Price Setting Dialog - Show before simulation starts */}
          {gameState.currentPhase === 'simulation' && !gameState.isActive && !initialPriceSet && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <Card className="w-full max-w-md bg-slate-800/95 backdrop-blur-sm border-slate-600 shadow-2xl">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl text-white">Set Your Initial Price</CardTitle>
                  <p className="text-slate-400 text-sm">Choose your starting price for the simulation. You can adjust it later with the "Update Price" button.</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">Initial Retail Price (€)</Label>
                    <Input
                      type="number"
                      value={tempPrice === 0 ? "" : tempPrice}
                      placeholder="199"
                      onChange={(e) => {
                        const value = e.target.value;
                        const numValue = value === "" ? 0 : Number(value);
                        setTempPrice(numValue);
                      }}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 text-lg font-mono min-h-[48px] rounded-xl"
                    />
                  </div>
                  <div className="text-sm text-slate-400 text-center">
                    Recommended range: €150 - €250
                  </div>
                  <Button
                    onClick={() => {
                      updateTeamDecision({ price: tempPrice });
                      setInitialPriceSet(true);
                    }}
                    disabled={tempPrice <= 0}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 rounded-lg shadow-lg transition-all duration-200 min-h-[48px]"
                  >
                    Confirm Initial Price (€{tempPrice})
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Fix Market - Show during Pre-Purchase Phase */}
          {gameState.currentPhase === 'prePurchase' && (
            <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm border-slate-600 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300" data-tutorial="fix-market">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl text-white">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <Award className="w-5 h-5 text-red-400" />
                  </div>
                  Fix Market Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl border border-red-500/30">
                    <div className="text-2xl font-bold text-red-400 mb-2">
                      {gameState.totalAircraftSeats || 1000}
                    </div>
                    <div className="text-slate-300 text-sm">Total Aircraft Seats (Market)</div>
                  </div>
                </div>

                {/* Hotel capacity and empty-bed cost awareness for purchase decisions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 rounded-xl border border-indigo-500/30">
                    <div className="text-2xl font-bold text-indigo-400 mb-2">
                      {currentTeam?.decisions?.hotelCapacity ?? (gameState.hotelCapacityPerTeam ?? '—')}
                    </div>
                    <div className="text-slate-300 text-sm">Your Hotel Beds (assigned)</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-600/20 rounded-xl border border-fuchsia-500/30">
                    <div className="text-2xl font-bold text-fuchsia-400 mb-2">
                      €{typeof gameState.hotelBedCost === 'number' ? gameState.hotelBedCost : 50}
                    </div>
                    <div className="text-slate-300 text-sm">Empty Bed Cost (per bed)</div>
                  </div>
                </div>

                {/* Team fix seats visibility to support purchase decision */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-sky-500/20 to-sky-600/20 rounded-xl border border-sky-500/30">
                    <div className="text-2xl font-bold text-sky-400 mb-2">
                      {currentTeam?.decisions?.fixSeatsRequested ?? currentTeam?.decisions?.fixSeatsPurchased ?? 0}
                    </div>
                    <div className="text-slate-300 text-sm">Your Fix Seats (requested)</div>
                  </div>
                </div>

                {/* Hide progress bar before allocation to avoid revealing demand */}

                {/* Team purchase activity is hidden before allocation to ensure anonymity and avoid demand signals */}

                  <div className="text-sm text-slate-400 bg-slate-700/20 rounded-lg p-3 border border-slate-600/30">
                    <div className="font-medium text-indigo-300 mb-2">💡 Strategic Information:</div>
                    <div>• Current airline reference price: €{gameState.fixSeatPrice} (auction determines the final price)</div>
                    <div>• Exact remaining availability is hidden; allocation will be announced after Phase 1</div>
                    <div>• Empty hotel beds cost €{typeof gameState.hotelBedCost === 'number' ? gameState.hotelBedCost : 50} each at round end</div>
                  </div>
              </CardContent>
            </Card>
          )}
          {allocationSummary && sortedAllocations.length > 0 && gameState.currentPhase === 'prePurchase' && (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300" data-tutorial="fixseat-allocation">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl text-white">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Award className="w-5 h-5 text-green-400" />
                  </div>
                  Fixed-Seat Allocation (Phase 1)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-1 p-4 rounded-xl border border-green-500/40 bg-green-500/10 shadow-inner">
                    <div className="text-xs uppercase tracking-wide text-green-200/80 mb-1">Your result</div>
                    <div className="text-3xl font-semibold text-white">
                      {myAllocation ? myAllocation.allocated : 0}
                    </div>
                    <div className="text-sm text-slate-200 mt-2">
                      {myAllocation
                        ? myAllocation.allocated > 0
                          ? `Clearing price: €${(((myAllocation.clearingPrice ?? gameState.fixSeatPrice) || 0)).toFixed(0)}`
                          : 'No fixed seats awarded'
                        : currentTeam
                          ? 'No bid submitted'
                          : isAdmin
                            ? 'Admin overview active'
                            : 'No team registered yet'}
                    </div>
                  </div>
                  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-600/60 bg-slate-700/30">
                      <div className="text-xs uppercase tracking-wide text-slate-400/80">Available fixed seats</div>
                      <div className="text-2xl font-semibold text-white">{allocationSummary.maxFixCapacity}</div>
                      <div className="text-xs text-slate-400 mt-1">Maximum capacity for round 1</div>
                    </div>
                    <div className="p-4 rounded-xl border border-blue-500/40 bg-blue-500/10">
                      <div className="text-xs uppercase tracking-wide text-blue-200/80">Allocated</div>
                      <div className="text-2xl font-semibold text-white">{allocationSummary.totalAllocated}</div>
                      <div className="text-xs text-blue-100/80 mt-1">Remaining fixed seats: {Math.max(0, allocationSummary.maxFixCapacity - allocationSummary.totalAllocated)}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400/80">Allocation by team</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {sortedAllocations.map(entry => {
                      const isMine = currentTeam ? entry.teamId === currentTeam.id : false;
                      return (
                        <div
                          key={entry.teamId}
                          className={`p-3 rounded-lg border transition-all duration-200 ${isMine ? 'border-indigo-400/70 bg-indigo-500/20 shadow-lg' : 'border-slate-700/60 bg-slate-700/30'}`}
                        >
                          <div className="flex items-center justify-between text-sm text-slate-200">
                            <span className={`font-semibold ${isMine ? 'text-white' : ''}`}>{entry.teamName}</span>
                            <span className="font-mono text-lg text-white">{entry.allocated}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Gebot: €{entry.bidPrice} • Clearing: {entry.clearingPrice ? `€${entry.clearingPrice}` : '—'}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">Angefragt: {entry.requested}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {gameState.currentPhase === 'simulation' && (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl text-white">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Award className="w-5 h-5 text-green-400" />
                  </div>
                  Fixed Seats
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-600/60 bg-slate-700/30">
                  <div className="text-xs uppercase tracking-wide text-slate-400/80">Remaining fixed seats</div>
                  <div className="text-2xl font-semibold text-white tabular-nums">{remainingFixSeats}</div>
                  <div className="text-xs text-slate-500 mt-1">Carry-over from the sealed auction</div>
                </div>
                <div className="p-4 rounded-xl border border-green-500/40 bg-green-500/10">
                  <div className="text-xs uppercase tracking-wide text-green-200/80">Purchased at</div>
                  <div className="text-2xl font-semibold text-white tabular-nums">
                    {typeof fixedSeatClearingPrice === 'number' && fixedSeatClearingPrice > 0 ? `€${fixedSeatClearingPrice.toFixed(0)}` : '—'}
                  </div>
                  <div className="text-xs text-green-100/80 mt-1">Clearing price from Phase 1</div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm border-slate-600 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300" data-tutorial="team-decisions">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl text-white">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Settings className="w-5 h-5 text-blue-400" />
                </div>
                Your Decisions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {gameState.currentPhase === 'prePurchase' ? (
                <div className="space-y-4">
                  <div className="text-slate-300 mb-4 text-sm font-medium">Pre-Purchase Fix Seats</div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">Bid per Fixed Seat (€)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={bidPriceInput}
                      placeholder={`${gameState.fixSeatPrice}`}
                      onChange={(e) => {
                        const value = e.target.value;
                        setBidPriceInput(value);
                        if (value === '') {
                          updateTeamDecision({ fixSeatBidPrice: 0 });
                          return;
                        }
                        const parsed = Number(value);
                        if (!Number.isFinite(parsed)) return;
                        const numValue = Math.max(1, Math.round(parsed));
                        updateTeamDecision({ fixSeatBidPrice: numValue });
                      }}
                      disabled={!gameState.isActive || gameState.currentPhase !== 'prePurchase'}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 text-lg font-mono min-h-[48px] rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">Purchase Quantity</Label>
                    <Input
                      type="number"
                      min={0}
                      // Cap by total fix seats to avoid leaking remaining availability; also cap by budget in round 1
                      max={(() => {
                        const capSeats = gameState.totalFixSeats || 500;
                        const budget = (gameState as any).perTeamBudget || 0;
                        const unit = currentTeam.decisions.fixSeatBidPrice && currentTeam.decisions.fixSeatBidPrice > 0 ? currentTeam.decisions.fixSeatBidPrice : (gameState.fixSeatPrice || 60);
                        const capByBudget = unit > 0 ? Math.floor(budget / unit) : capSeats;
                        return Math.max(0, Math.min(capSeats, capByBudget));
                      })()}
                      value={bidQuantityInput}
                      placeholder="0"
                      onChange={(e) => {
                        const value = e.target.value;
                        setBidQuantityInput(value);
                        if (value === '') {
                          updateTeamDecision({ fixSeatsPurchased: 0 });
                          return;
                        }
                        const parsed = Number(value);
                        if (!Number.isFinite(parsed)) return;
                        const capSeats = gameState.totalFixSeats || 500;
                        const budget = (gameState as any).perTeamBudget || 0;
                        const unit = currentTeam.decisions.fixSeatBidPrice && currentTeam.decisions.fixSeatBidPrice > 0 ? currentTeam.decisions.fixSeatBidPrice : (gameState.fixSeatPrice || 60);
                        const capByBudget = unit > 0 ? Math.floor(budget / unit) : capSeats;
                        const cap = Math.max(0, Math.min(capSeats, capByBudget));
                        const numValue = Math.max(0, Math.min(cap, parsed));
                        updateTeamDecision({ fixSeatsPurchased: numValue });
                      }}
                      disabled={!gameState.isActive || gameState.currentPhase !== 'prePurchase'}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 text-lg font-mono min-h-[48px] rounded-xl"
                    />
                  </div>
                  <div className="text-sm text-slate-400">
                    Estimated Cost: €{
                      (currentTeam.decisions.fixSeatsRequested ?? currentTeam.decisions.fixSeatsPurchased ?? 0)
                      * (currentTeam.decisions.fixSeatBidPrice && currentTeam.decisions.fixSeatBidPrice > 0 ? currentTeam.decisions.fixSeatBidPrice : (gameState.fixSeatPrice || 60))
                    } { (gameState as any).perTeamBudget ? `| Budget: €${(gameState as any).perTeamBudget}` : ''}
                  </div>
                </div>
              ) : gameState.currentPhase === 'simulation' ? (
                <div className="space-y-6">
                  <div className="grid gap-6 lg:grid-cols-12">
                    <Card className="lg:col-span-5 bg-slate-800/70 border-slate-600">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-lg">Price Control</CardTitle>
                        <p className="text-xs text-slate-400">Steer demand by adjusting your live retail price.</p>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-sm text-slate-400">Current retail price</span>
                          <span className="text-3xl font-bold text-white tabular-nums">€{priceSliderValue.toLocaleString('de-DE')}</span>
                        </div>
                        <Slider
                          value={[priceSliderValue]}
                          min={priceMin}
                          max={priceMax}
                          step={1}
                          onValueChange={(values) => {
                            const value = values[0] ?? priceSliderValue;
                            const clamped = Math.min(priceMax, Math.max(priceMin, Math.round(value)));
                            setPriceSliderValue(clamped);

                            if (!currentTeam) return;
                            if (priceUpdateTimer.current) {
                              window.clearTimeout(priceUpdateTimer.current);
                            }
                            priceUpdateTimer.current = window.setTimeout(() => {
                              updateTeamDecision({ price: clamped });
                            }, 200);
                          }}
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>€{priceMin}</span>
                          <span>€{priceMax}</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Changes apply immediately for new bookings. Keep an eye on the pooling price trend to react ahead of the market.
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="lg:col-span-7 bg-slate-800/70 border-slate-600">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-lg">Pooling Price Trend</CardTitle>
                      </CardHeader>
                      <CardContent className="h-64">
                        {priceHistoryData.length > 1 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={priceHistoryData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="poolPriceGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.45} />
                                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} minTickGap={20} />
                              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} width={48} />
                              <RechartsTooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                                formatter={(value: any) => [`€${Number(value).toFixed(0)}`, 'Pooling price']}
                              />
                              <Area type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2} fill="url(#poolPriceGradient)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-slate-400">
                            Waiting for price updates…
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-600/60 bg-slate-700/40 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-400/80">Current revenue</div>
                      <div className="text-2xl font-semibold text-white tabular-nums">€{Number.isFinite(currentRevenue) ? currentRevenue.toLocaleString('de-DE') : '0'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-600/60 bg-slate-700/40 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-400/80">Seats sold so far</div>
                      <div className="text-2xl font-semibold text-white tabular-nums">{Number.isFinite(seatsSoldSoFar) ? seatsSoldSoFar.toLocaleString('de-DE') : '0'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-600/60 bg-slate-700/40 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-400/80">Pooling price</div>
                      <div className="text-2xl font-semibold text-white tabular-nums">€{Number.isFinite(poolingPrice) ? poolingPrice.toLocaleString('de-DE') : '0'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-600/60 bg-slate-700/40 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-400/80">Days to departure</div>
                      <div className="text-2xl font-semibold text-white tabular-nums">{daysToDeparture.toLocaleString('de-DE')}</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Pooling seats are purchased automatically whenever demand exceeds your remaining fixed inventory.
                  </p>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-8">
                  Waiting for phase to start...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pooling Market */}
          {gameState.currentPhase === 'simulation' && gameState.poolingMarket && (
            <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm border-slate-600 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300" data-tutorial="pooling-market">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl text-white">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Waves className="w-5 h-5 text-purple-400" />
                  </div>
                  Pooling Market
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Budget card */}
                {(() => {
                  const st = (gameState as any).simState?.perTeam?.[currentTeam.id] || {};
                  const budget = (gameState as any).perTeamBudget || 0;
                  const fixUnit = currentTeam.decisions.fixSeatClearingPrice && currentTeam.decisions.fixSeatClearingPrice > 0
                    ? currentTeam.decisions.fixSeatClearingPrice
                    : (gameState.fixSeatPrice || 60);
                  const price = currentTeam.decisions.price || 199;
                  const assignedBeds = typeof currentTeam.decisions?.hotelCapacity === 'number' ? currentTeam.decisions.hotelCapacity : (gameState.hotelCapacityPerTeam || 0);
                  const sold = Math.max(0, Number(st.sold || 0));
                  const revenueAccum = Math.max(0, Number(st.revenue || (sold * price)));
                  // costAccum already includes fixed costs recorded at sim start plus variable pooling costs
                  const costAccum = Math.max(0, Number(st.cost || ((currentTeam.decisions.fixSeatsAllocated || 0) * fixUnit)));
                  // conservative estimate of potential hotel costs based on current empty beds
                  const emptyBedsNow = Math.max(0, assignedBeds - sold);
                  const hotelBedCost = typeof gameState.hotelBedCost === 'number' ? gameState.hotelBedCost : 50;
                  const hotelCostEstimate = emptyBedsNow * hotelBedCost;
                  const currentBudget = Math.round(budget - costAccum - hotelCostEstimate + revenueAccum);
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl border border-emerald-500/30">
                        <div className="text-2xl font-bold text-emerald-400 mb-2">€{budget}</div>
                        <div className="text-slate-300 text-sm">Starting Budget</div>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 rounded-xl border border-indigo-500/30">
                        <div className="text-2xl font-bold text-indigo-400 mb-2">€{currentBudget}</div>
                        <div className="text-slate-300 text-sm">Current Budget (est.)</div>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-600/20 rounded-xl border border-fuchsia-500/30">
                        <div className="text-2xl font-bold text-fuchsia-400 mb-2">{sold}</div>
                        <div className="text-slate-300 text-sm">Passengers Sold so far</div>
                      </div>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl border border-purple-500/30">
                    <div className="text-2xl font-bold text-purple-400 mb-2">
                      €{gameState.poolingMarket.currentPrice.toFixed(2)}
                    </div>
                    <div className="text-slate-300 text-sm">Current Price</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl border border-blue-500/30">
                    <div className="text-2xl font-bold text-blue-400 mb-2">
                      {gameState.poolingMarket.offeredPoolingCapacity}
                    </div>
                    <div className="text-slate-300 text-sm">Offered Capacity</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl border border-orange-500/30">
                    <div className="text-2xl font-bold text-orange-400 mb-2">
                      {gameState.poolingMarket.currentDemand}
                    </div>
                    <div className="text-slate-300 text-sm">Market Demand</div>
                  </div>
                </div>
                <div className="text-sm text-slate-400">
                  Supply updates every {gameState.poolingMarketUpdateInterval || 1} second{gameState.poolingMarketUpdateInterval !== 1 ? 's' : ''}
                  {' '}({gameState.simulatedWeeksPerUpdate || 1} simulated day{gameState.simulatedWeeksPerUpdate !== 1 ? 's' : ''} per step),
                  while the airline reprices pooling seats every 7 simulated days.
                </div>
              </CardContent>
            </Card>
          )}

          {/* Round Results */}
          {roundResults && (
            <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm border-slate-600 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-white">Round {gameState.currentRound} Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-6 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl border border-blue-500/30">
                    <div className="text-4xl font-bold text-blue-400 mb-2">
                      {roundResults.find(r => r.teamId === currentTeam.id)?.sold || 0}
                    </div>
                    <div className="text-slate-300 text-sm">Seats Sold</div>
                  </div>
                  <div className="text-center p-6 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl border border-green-500/30">
                    <div className="text-4xl font-bold text-green-400 mb-2">
                      €{(roundResults.find(r => r.teamId === currentTeam.id)?.profit || 0).toFixed(0)}
                    </div>
                    <div className="text-slate-300 text-sm">Profit</div>
                  </div>
                </div>
                {(() => {
                  const rr = roundResults.find(r => r.teamId === currentTeam.id);
                  if (rr && (rr as any).insolvent) {
                    return <div className="mt-4 text-center text-red-400 text-sm">⚠️ Insolvent this round (over budget)</div>;
                  }
                  return null;
                })()}
              </CardContent>
            </Card>
          )}

          {/* Live Competition */}
          <LiveCompetition
            currentTeam={currentTeam}
            leaderboard={leaderboard || []}
            roundResults={roundResults || []}
          />

          {/* Motivational Messages */}
          <MotivationalMessages
            currentTeam={currentTeam}
            roundResults={roundResults || []}
            leaderboard={leaderboard || []}
          />

          {/* Streak Counter */}
          <StreakCounter
            currentTeam={currentTeam}
            roundResults={roundResults || []}
          />

          {/* Sound Effects */}
          <SoundEffects playSound={soundEffect} />
          {/* Practice Mode overlay removed; runs integrated via context */}

          {/* Leaderboard */}
          {leaderboard && (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300" data-tutorial="leaderboard">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl text-white">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Award className="w-5 h-5 text-yellow-400" />
                  </div>
                  High Scores (Revenue)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {leaderboard.slice(0, 5).map((entry, index) => {
                    const TeamIcon = getTeamIconByName(entry.name);
                    return (
                      <div key={entry.name} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-700/30 to-slate-600/20 border border-slate-600/50 hover:from-slate-700/50 hover:to-slate-600/30 transition-all duration-200">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm">
                            #{index + 1}
                          </div>
                          <div className="p-1 bg-slate-600/50 rounded-lg">
                            <TeamIcon className="w-4 h-4 text-slate-300" />
                          </div>
                          <span className={`font-semibold text-lg ${entry.name === currentTeam.name ? 'text-indigo-400' : 'text-white'}`}>
                            {entry.name}
                          </span>
                        </div>
                        <div className="text-xl font-bold text-green-400 tabular-nums">€{(entry.revenue ?? 0).toFixed(0)}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tutorial Tour */}
        <TutorialTour
          isActive={tutorialActive}
          onComplete={completeTutorial}
          onSkip={skipTutorial}
          currentStep={tutorialStep}
          onStepChange={(step) => setTutorialStep(step)}
        />
      </div>
    );
  }

  return null;
};

export default MultiUserApp;

// Small helper component for team logout to access context cleanly
function TeamLogoutButton() {
  const { currentTeam, logoutTeam } = useGame();
  if (!currentTeam) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => logoutTeam()}
      className="bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700/80 backdrop-blur-sm shadow-lg min-h-[44px] text-sm"
      title="Logout"
    >
      Logout
    </Button>
  );
}
