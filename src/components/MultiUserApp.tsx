import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../contexts/GameContext';
import { TeamRegistration } from './MultiUserTeamRegistration';
import { AdminLogin } from './AdminLogin';
import AdminPanel from './AdminPanel';
import RoundTimer from './RoundTimer';
import Tutorial from './Tutorial';
import TutorialTour from './TutorialTour';
import AchievementSystem from './AchievementSystem';
import StreakCounter from './StreakCounter';
import MotivationalMessages from './MotivationalMessages';
import LiveCompetition from './LiveCompetition';
import SoundEffects from './SoundEffects';
import { PracticeMode } from './PracticeMode';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Users, Award, Settings, MapPin, Sun, Camera, Compass, Anchor, Mountain, Tent, Binoculars, Map, Navigation, Waves, Snowflake, Eye, Star, Coffee } from 'lucide-react';

const TEAM_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

const TOURIST_ICONS = [Sun, Camera, Compass, Anchor, MapPin, Mountain, Tent, Binoculars, Map, Navigation, Waves, Snowflake, Eye, Star, Coffee];

// Function to get a consistent icon for each team based on team name
const getTeamIconByName = (teamName: string) => {
  const iconIndex = teamName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % TOURIST_ICONS.length;
  return TOURIST_ICONS[iconIndex];
};

export const MultiUserApp: React.FC = () => {
  const {
    gameState,
    currentTeam,
    isAdmin,
    roundResults,
    leaderboard,
  roundHistory,
    updateTeamDecision,
    updateGameSettings,
    startPrePurchasePhase,
    startSimulationPhase,
    endRound,
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
  const [showPractice, setShowPractice] = useState(false);

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

  // Always show tutorial on page load
  useEffect(() => {
    setShowTutorial(true);
  }, []);

  // Get leaderboard when round ends
  useEffect(() => {
    if (roundResults) {
      getLeaderboard();
    }
  }, [roundResults, getLeaderboard]);

  // Reset tutorial when not active
  useEffect(() => {
    if (!tutorialActive && tutorialStep !== 0) {
      console.log('Resetting tutorial step to 0');
      // Note: We don't call the context function here to avoid loops
    }
  }, [tutorialActive, tutorialStep]);

  // 1) Tutorial first
  if (showTutorial) {
    return <Tutorial
      onStart={() => {
        setShowTutorial(false);
        // Don't set localStorage since we want tutorial to show every time
      }}
      onStartTour={() => {
        setShowTutorial(false);
        // Start the interactive tutorial
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
        <TeamRegistration />
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
        <TeamRegistration />
      </div>
    );
  }

  // Admin view
  if (isAdmin) {
    const roundTimeMinutes = Math.max(1, Math.round(gameState.roundTime / 60));
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        {/* Top-right Admin Logout */}
        <div className="fixed top-4 right-4 z-50">
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
          numTeams={gameState.teams.length}
          setNumTeams={() => { /* Teamanzahl wird durch Registrierungen bestimmt */ }}
          rounds={gameState.totalRounds}
          setRounds={(v) => updateGameSettings({ totalRounds: v })}
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
        />

        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <header className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <Waves className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Airline Procurement & Demand Simulation
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
                  Leaderboard
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
                      <div className="text-2xl font-bold text-green-400 tabular-nums">€{entry.profit.toFixed(0)}</div>
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
        {/* Admin Login Button - only visible if not registered as team or if admin */}
        <div className="fixed top-4 right-4 z-40 flex gap-2">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPractice(true)}
            className="bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700/80 backdrop-blur-sm shadow-lg min-h-[44px] text-sm"
            title="Start Practice Mode"
          >
            Practice Mode
          </Button>
        </div>

        <RoundTimer
          roundTime={roundTimeMinutes}
          isActive={gameState.isActive}
          onTimeUp={() => {}}
          currentPhase={gameState.currentPhase}
        />

        <AdminPanel
          numTeams={gameState.teams.length}
          setNumTeams={() => { /* Teamanzahl wird durch Registrierungen bestimmt */ }}
          rounds={gameState.totalRounds}
          setRounds={(v) => updateGameSettings({ totalRounds: v })}
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
                Airline Procurement & Demand Simulation
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl border border-red-500/30">
                    <div className="text-2xl font-bold text-red-400 mb-2">
                      {gameState.totalFixSeats || 500}
                    </div>
                    <div className="text-slate-300 text-sm">Total Fix Seats Available</div>
                  </div>
                  {/* Hide exact remaining availability and utilization until allocation */}
                  <div className="text-center p-4 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl border border-orange-500/30">
                    <div className="text-2xl font-bold text-orange-400 mb-2">—</div>
                    <div className="text-slate-300 text-sm">Remaining (hidden)</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl border border-green-500/30">
                    <div className="text-2xl font-bold text-green-400 mb-2">—</div>
                    <div className="text-slate-300 text-sm">Market Utilization (hidden)</div>
                  </div>
                </div>

                {/* Hide progress bar before allocation to avoid revealing demand */}

                {/* Team purchase activity is hidden before allocation to ensure anonymity and avoid demand signals */}

                <div className="text-sm text-slate-400 bg-slate-700/20 rounded-lg p-3 border border-slate-600/30">
                  <div className="font-medium text-indigo-300 mb-2">💡 Strategic Information:</div>
                  <div>• Fix seats are purchased at €{gameState.fixSeatPrice} each (guaranteed capacity)</div>
                  <div>• Exact remaining availability is hidden; allocation will be announced after Phase 1</div>
                  <div>• First come, first served - act quickly to secure your capacity!</div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm font-medium">Maximum Requestable Fix Seats (hidden)</Label>
                      <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600 text-center">
                        <span className="text-2xl font-bold text-orange-400 tabular-nums">—</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm font-medium">Fix Seat Price (€)</Label>
                      <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600 text-center">
                        <span className="text-2xl font-bold text-green-400 tabular-nums">
                          €{gameState.fixSeatPrice}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">Purchase Quantity</Label>
                    <Input
                      type="number"
                      min={0}
                      // Cap by total fix seats to avoid leaking remaining availability
                      max={gameState.totalFixSeats || 500}
                      value={currentTeam.decisions.fixSeatsPurchased === 0 ? "" : (currentTeam.decisions.fixSeatsPurchased || "")}
                      placeholder="0"
                      onChange={(e) => {
                        const value = e.target.value;
                        const cap = gameState.totalFixSeats || 500;
                        const numValue = value === "" ? 0 : Math.max(0, Math.min(cap, Number(value)));
                        updateTeamDecision({ fixSeatsPurchased: numValue });
                      }}
                      disabled={!gameState.isActive || gameState.currentPhase !== 'prePurchase'}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 text-lg font-mono min-h-[48px] rounded-xl"
                    />
                  </div>
                  <div className="text-sm text-slate-400">
                    Total Cost: €{(currentTeam.decisions.fixSeatsPurchased || 0) * gameState.fixSeatPrice}
                  </div>
                </div>
              ) : gameState.currentPhase === 'simulation' ? (
                <div className="space-y-4">
                  <div className="text-slate-300 mb-4 text-sm font-medium">Simulation Settings</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm font-medium">Retail Price (€)</Label>
                      <Input
                        type="number"
                        value={currentTeam.decisions.price === 0 ? "" : (currentTeam.decisions.price || "")}
                        placeholder="0"
                        onChange={(e) => {
                          const value = e.target.value;
                          const numValue = value === "" ? 0 : Number(value);
                          updateTeamDecision({ price: numValue });
                        }}
                        disabled={!gameState.isActive}
                        className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 text-lg font-mono min-h-[48px] rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm font-medium">Pooling Allocation (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={currentTeam.decisions.poolingAllocation === 0 ? "" : (currentTeam.decisions.poolingAllocation || "")}
                        placeholder="0"
                        onChange={(e) => {
                          const value = e.target.value;
                          const numValue = value === "" ? 0 : Math.max(0, Math.min(100, Number(value)));
                          updateTeamDecision({ poolingAllocation: numValue });
                        }}
                        disabled={!gameState.isActive}
                        className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 text-lg font-mono min-h-[48px] rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => updateTeamDecision({ price: currentTeam.decisions.price })}
                      disabled={!gameState.isActive}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-4 py-2 rounded-lg shadow-lg transition-all duration-200 min-h-[44px] text-sm"
                    >
                      Update Price
                    </Button>
                  </div>
                  <div className="text-sm text-slate-400">
                    Your Fix Seats: {currentTeam.decisions.fixSeatsPurchased || 0} | Pooling Capacity: {Math.round((currentTeam.decisions.poolingAllocation || 0) / 100 * gameState.totalCapacity)}
                  </div>
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
                {gameState.poolingMarket.priceHistory && gameState.poolingMarket.priceHistory.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">Price History (Last 10 Updates)</Label>
                    <div className="flex gap-1 overflow-x-auto pb-2">
                      {gameState.poolingMarket.priceHistory.slice(-10).map((price, index) => (
                        <div key={index} className="flex-shrink-0 w-12 h-8 bg-slate-700/50 rounded border border-slate-600 flex items-center justify-center">
                          <span className="text-xs font-mono text-slate-300">€{price.price.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-slate-400">
                      Price Trend: {gameState.poolingMarket.priceHistory.length > 1 ?
                        (gameState.poolingMarket.priceHistory[gameState.poolingMarket.priceHistory.length - 1].price > gameState.poolingMarket.priceHistory[gameState.poolingMarket.priceHistory.length - 2].price ?
                          '↗️ Rising' : '↘️ Falling') : '➡️ Stable'}
                    </div>
                  </div>
                )}
                <div className="text-sm text-slate-400">
                  Pooling market updates every {gameState.poolingMarketUpdateInterval || 1} second{gameState.poolingMarketUpdateInterval !== 1 ? 's' : ''} during simulation phase ({gameState.simulatedWeeksPerUpdate || 1} day{gameState.simulatedWeeksPerUpdate !== 1 ? 's' : ''} simulated per update)
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
          <AchievementSystem
            currentTeam={currentTeam}
            roundResults={roundResults || []}
            leaderboard={leaderboard || []}
            onPlaySound={setSoundEffect}
          />

          {/* Practice Mode Overlay */}
          {showPractice && (
            <PracticeMode onClose={() => setShowPractice(false)} humanTeamName={currentTeam.name} />
          )}

          {/* Leaderboard */}
          {leaderboard && (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300" data-tutorial="leaderboard">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl text-white">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Award className="w-5 h-5 text-yellow-400" />
                  </div>
                  Current Standings
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
                        <div className="text-xl font-bold text-green-400 tabular-nums">€{entry.profit.toFixed(0)}</div>
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
