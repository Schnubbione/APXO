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

const TEAM_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export const MultiUserApp: React.FC = () => {
  const {
    gameState,
    currentTeam,
    isAdmin,
    roundResults,
    leaderboard,
    updateTeamDecision,
    startRound,
    endRound,
    getLeaderboard
  } = useGame();

  const [showTutorial, setShowTutorial] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

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

  if (showTutorial) {
    return <Tutorial onStart={() => {
      setShowTutorial(false);
      localStorage.setItem('hasSeenTutorial', 'true');
    }} />;
  }

  if (showAdminLogin) {
    return <AdminLogin />;
  }

  // If not registered and not admin, show registration
  if (!currentTeam && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="flex justify-center pt-8">
          <Button
            variant="outline"
            onClick={() => setShowAdminLogin(true)}
            className="min-h-[44px]"
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
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-800 p-2 sm:p-4 lg:p-8">
        <AdminPanel
          numTeams={gameState.teams.length}
          setNumTeams={() => {}} // Handled by backend
          rounds={gameState.totalRounds}
          setRounds={() => {}}
          baseDemand={gameState.baseDemand}
          setBaseDemand={() => {}}
          spread={gameState.spread}
          setSpread={() => {}}
          shock={gameState.shock}
          setShock={() => {}}
          sharedMarket={gameState.sharedMarket}
          setSharedMarket={() => {}}
          seed={gameState.seed}
          setSeed={() => {}}
          onStartRound={startRound}
          onEndRound={endRound}
          roundTime={gameState.roundTime}
          setRoundTime={() => {}}
          isAdmin={true}
          setIsAdmin={() => {}}
        />

        <RoundTimer
          roundTime={gameState.roundTime}
          isActive={gameState.isActive}
          onTimeUp={endRound}
        />

        <div className="max-w-7xl mx-auto grid gap-4 sm:gap-6 pt-16 sm:pt-0">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <Plane className="w-6 h-6 sm:w-8 sm:h-8" />
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-semibold">
                Airline Procurement & Demand Simulation - Admin View
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdminLogin(false)} className="min-h-[44px]">
                Logout
              </Button>
            </div>
          </header>

          {/* Teams Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                Registered Teams ({gameState.teams.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:gap-4">
                {gameState.teams.map((team, index) => (
                  <div key={team.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg gap-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded-full"
                        style={{ backgroundColor: TEAM_COLORS[index % TEAM_COLORS.length] }}
                      />
                      <span className="font-medium text-sm sm:text-base">{team.name}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600 sm:text-right">
                      Price: €{team.decisions.price} |
                      Capacity: {Object.values(team.decisions.buy).reduce((a, b) => Number(a) + Number(b), 0)} seats
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          {leaderboard && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                  Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between p-2 rounded-xl border bg-white/60">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">#{index + 1}</span>
                        <span className="font-medium text-sm">{entry.name}</span>
                      </div>
                      <div className="tabular-nums font-semibold text-sm">{entry.profit.toFixed(0)} €</div>
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
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-800 p-2 sm:p-4 lg:p-8">
        <RoundTimer
          roundTime={gameState.roundTime}
          isActive={gameState.isActive}
          onTimeUp={() => {}}
        />

        <div className="max-w-7xl mx-auto grid gap-4 sm:gap-6 pt-12 sm:pt-0">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <Plane className="w-6 h-6 sm:w-8 sm:h-8" />
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-semibold">
                Airline Procurement & Demand Simulation
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs sm:text-sm text-slate-600">
                Team: <span className="font-medium">{currentTeam.name}</span>
              </div>
            </div>
          </header>

          {/* Round Status */}
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold">
                  Round {gameState.currentRound} of {gameState.totalRounds}
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-2">
                  {gameState.isActive ? 'Round in progress...' : 'Waiting for admin to start round'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Decision Making */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                Your Decisions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-sm">Retail Price (€)</Label>
                  <Input
                    type="number"
                    value={currentTeam.decisions.price}
                    onChange={(e) => updateTeamDecision({ price: Number(e.target.value) })}
                    disabled={gameState.isActive}
                    className="text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <Label className="text-sm">Capacity (Seats)</Label>
                  <div className="p-2 rounded-lg bg-slate-50 border tabular-nums text-sm">
                    {Object.values(currentTeam.decisions.buy).reduce((a, b) => Number(a) + Number(b), 0)}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs sm:text-sm text-slate-600 mb-2">Procurement from Carrier</div>
                {/* Mobile: Stack vertically */}
                <div className="block sm:hidden space-y-2">
                  {gameState.fares.map((fare) => (
                    <div key={fare.code} className="p-3 border rounded-lg space-y-2">
                      <div className="font-medium text-sm">{fare.label} ({fare.code})</div>
                      <div className="flex justify-between items-center text-xs text-slate-600">
                        <span>Price:</span>
                        <span className="tabular-nums">{fare.cost.toFixed(0)} €</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-600">Quantity:</span>
                        <Input
                          type="number"
                          min={0}
                          value={currentTeam.decisions.buy[fare.code] || 0}
                          onChange={(e) => updateTeamDecision({
                            buy: { ...currentTeam.decisions.buy, [fare.code]: Math.max(0, Number(e.target.value)) }
                          })}
                          disabled={gameState.isActive}
                          className="w-20 text-sm min-h-[44px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: Table layout */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 text-sm text-slate-500">Fare</div>
                    <div className="col-span-3 text-sm text-slate-500">Price</div>
                    <div className="col-span-4 text-sm text-slate-500">Quantity</div>
                  </div>
                  {gameState.fares.map((fare) => (
                    <div key={fare.code} className="grid grid-cols-12 gap-2 items-center py-1">
                      <div className="col-span-5 text-sm">{fare.label} ({fare.code})</div>
                      <div className="col-span-3 tabular-nums text-sm">{fare.cost.toFixed(0)} €</div>
                      <div className="col-span-4">
                        <Input
                          type="number"
                          min={0}
                          value={currentTeam.decisions.buy[fare.code] || 0}
                          onChange={(e) => updateTeamDecision({
                            buy: { ...currentTeam.decisions.buy, [fare.code]: Math.max(0, Number(e.target.value)) }
                          })}
                          disabled={gameState.isActive}
                          className="text-sm min-h-[44px]"
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Round {gameState.currentRound} Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-blue-600">
                      {roundResults.find(r => r.teamId === currentTeam.id)?.sold || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600">Seats Sold</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-green-600">
                      €{(roundResults.find(r => r.teamId === currentTeam.id)?.profit || 0).toFixed(0)}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600">Profit</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leaderboard */}
          {leaderboard && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                  Current Standings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between p-2 rounded-xl border bg-white/60">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">#{index + 1}</span>
                        <span className={`font-medium text-sm ${entry.name === currentTeam.name ? 'text-blue-600' : ''}`}>
                          {entry.name}
                        </span>
                      </div>
                      <div className="tabular-nums font-semibold text-sm">{entry.profit.toFixed(0)} €</div>
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
