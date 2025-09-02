import React, { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { TeamRegistration } from './MultiUserTeamRegistration';
import { AdminLogin } from './AdminLogin';
import AdminPanel from './AdminPanel';
import RoundTimer from './RoundTimer';
import Tutorial from './Tutorial';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Plane, Users, Award, Settings } from 'lucide-react';

const TEAM_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export const MultiUserApp: React.FC = () => {
  const {
    gameState,
    currentTeam,
    isAdmin,
    roundResults,
    leaderboard,
  updateTeamDecision,
  updateGameSettings,
    startRound,
    endRound,
    getLeaderboard
  } = useGame();

  const [showTutorial, setShowTutorial] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Debug: Log state changes
  React.useEffect(() => {
    console.log('App state:', { currentTeam: currentTeam?.name, isAdmin, showAdminLogin });
  }, [currentTeam, isAdmin, showAdminLogin]);

  // Show tutorial on first visit
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  // Get leaderboard when round ends
  useEffect(() => {
    if (roundResults) {
      getLeaderboard();
    }
  }, [roundResults, getLeaderboard]);

  // If admin login was successful, reset showAdminLogin (hook must be before any returns)
  React.useEffect(() => {
    if (isAdmin && showAdminLogin) {
      setShowAdminLogin(false);
    }
  }, [isAdmin, showAdminLogin]);

  // 1) Tutorial first
  if (showTutorial) {
    return <Tutorial onStart={() => {
      setShowTutorial(false);
      localStorage.setItem('hasSeenTutorial', 'true');
    }} />;
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
          onStartRound={startRound}
          onEndRound={endRound}
          roundTime={roundTimeMinutes}
          setRoundTime={(v) => updateGameSettings({ roundTime: v * 60 })}
          isAdmin={true}
          setIsAdmin={() => { /* handled via reload in AdminPanel */ }}
        />

        <RoundTimer
          roundTime={roundTimeMinutes}
          isActive={gameState.isActive}
          onTimeUp={endRound}
        />

        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <header className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <Plane className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Airline Procurement & Demand Simulation
              </h1>
            </div>
            <p className="text-slate-400 text-lg">Admin Control Panel</p>
          </header>          {/* Teams Overview */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 shadow-2xl">
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
                {gameState.teams.map((team, index) => (
                  <div key={team.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-700/30 rounded-xl border border-slate-600/50 hover:bg-slate-700/50 transition-all duration-200">
                    <div className="flex items-center gap-3 mb-2 sm:mb-0">
                      <div
                        className="w-4 h-4 rounded-full shadow-lg"
                        style={{ backgroundColor: TEAM_COLORS[index % TEAM_COLORS.length] }}
                      />
                      <span className="font-semibold text-white text-lg">{team.name}</span>
                    </div>
                    <div className="text-sm text-slate-300 sm:text-right">
                      Price: <span className="font-mono text-indigo-400">€{team.decisions.price}</span> |
                      Capacity: <span className="font-mono text-green-400">{Object.values(team.decisions.buy).reduce((a, b) => Number(a) + Number(b), 0)} seats</span>
                    </div>
                  </div>
                ))}
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
        {/* Admin Login Button - always visible */}
        <div className="fixed top-4 right-4 z-40">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdminLogin(true)}
            className="bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700/80 backdrop-blur-sm shadow-lg min-h-[44px] text-sm"
          >
            Admin Login
          </Button>
        </div>

        <RoundTimer
          roundTime={roundTimeMinutes}
          isActive={gameState.isActive}
          onTimeUp={() => {}}
        />

        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <header className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <Plane className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Airline Procurement & Demand Simulation
              </h1>
            </div>
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Team: {currentTeam.name}</span>
            </div>
          </header>          {/* Round Status */}
          <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm border-slate-600 shadow-2xl">
            <CardContent className="pt-6 sm:pt-8">
              <div className="text-center">
                <div className="text-4xl sm:text-5xl font-bold text-white mb-2">
                  Round {gameState.currentRound} of {gameState.totalRounds}
                </div>
                <div className="text-lg text-slate-300">
                  {gameState.isActive ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Round in progress...
                    </span>
                  ) : (
                    <span className="text-slate-400">Waiting for admin to start round</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Decision Making */}
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 shadow-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl text-white">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Settings className="w-5 h-5 text-blue-400" />
                </div>
                Your Decisions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm font-medium">Retail Price (€)</Label>
                  <Input
                    type="number"
                    value={currentTeam.decisions.price}
                    onChange={(e) => updateTeamDecision({ price: Number(e.target.value) })}
                    disabled={gameState.isActive}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 text-lg font-mono min-h-[48px] rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm font-medium">Capacity (Seats)</Label>
                  <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600 text-center">
                    <span className="text-2xl font-bold text-green-400 tabular-nums">
                      {Object.values(currentTeam.decisions.buy).reduce((a, b) => Number(a) + Number(b), 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-slate-300 mb-4 text-sm font-medium">Procurement from Carrier</div>
                {/* Mobile: Stack vertically */}
                <div className="block sm:hidden space-y-3">
                  {gameState.fares.map((fare) => (
                    <div key={fare.code} className="p-4 border border-slate-600 rounded-xl bg-slate-700/30 space-y-3">
                      <div className="font-semibold text-white text-lg">{fare.label} ({fare.code})</div>
                      <div className="text-sm text-slate-400">
                        {fare.code === 'F' && 'Fix: Cheapest, but must be paid regardless of demand'}
                        {fare.code === 'P' && 'ProRata: More expensive, can be returned until 60 days before departure if not booked'}
                        {fare.code === 'O' && 'Pooling: Daily price updates, not guaranteed, only paid if actual demand exists'}
                      </div>
                      <div className="flex justify-between items-center text-sm text-slate-300">
                        <span>Price:</span>
                        <span className="font-mono text-indigo-400 tabular-nums">€{fare.cost.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Quantity:</span>
                        <Input
                          type="number"
                          min={0}
                          value={currentTeam.decisions.buy[fare.code] || 0}
                          onChange={(e) => updateTeamDecision({
                            buy: { ...currentTeam.decisions.buy, [fare.code]: Math.max(0, Number(e.target.value)) }
                          })}
                          disabled={gameState.isActive}
                          className="w-20 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 text-lg font-mono min-h-[44px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: Table layout */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-12 gap-4 items-center mb-4">
                    <div className="col-span-4 text-slate-300 text-sm font-medium">Product</div>
                    <div className="col-span-4 text-slate-300 text-sm font-medium">Description</div>
                    <div className="col-span-2 text-slate-300 text-sm font-medium">Price</div>
                    <div className="col-span-2 text-slate-300 text-sm font-medium">Quantity</div>
                  </div>
                  {gameState.fares.map((fare) => (
                    <div key={fare.code} className="grid grid-cols-12 gap-4 items-center py-3 px-4 rounded-lg bg-slate-700/20 hover:bg-slate-700/30 transition-colors">
                      <div className="col-span-4 text-white font-medium">{fare.label} ({fare.code})</div>
                      <div className="col-span-4 text-sm text-slate-400">
                        {fare.code === 'F' && 'Fix: Must be paid regardless of demand'}
                        {fare.code === 'P' && 'ProRata: Can be returned until 60 days before departure'}
                        {fare.code === 'O' && 'Pooling: Only paid if actual demand exists'}
                      </div>
                      <div className="col-span-2 tabular-nums text-indigo-400 font-mono font-semibold">€{fare.cost.toFixed(0)}</div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          value={currentTeam.decisions.buy[fare.code] || 0}
                          onChange={(e) => updateTeamDecision({
                            buy: { ...currentTeam.decisions.buy, [fare.code]: Math.max(0, Number(e.target.value)) }
                          })}
                          disabled={gameState.isActive}
                          className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 text-sm font-mono min-h-[40px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Round Results */}
          {roundResults && (
            <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm border-slate-600 shadow-2xl">
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

          {/* Leaderboard */}
          {leaderboard && (
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 shadow-2xl">
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
                  {leaderboard.slice(0, 5).map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-700/30 to-slate-600/20 border border-slate-600/50 hover:from-slate-700/50 hover:to-slate-600/30 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm">
                          #{index + 1}
                        </div>
                        <span className={`font-semibold text-lg ${entry.name === currentTeam.name ? 'text-indigo-400' : 'text-white'}`}>
                          {entry.name}
                        </span>
                      </div>
                      <div className="text-xl font-bold text-green-400 tabular-nums">€{entry.profit.toFixed(0)}</div>
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

  return null;
};
