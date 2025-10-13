import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Users, Lightbulb } from 'lucide-react';

type TeamRegistrationProps = {
  onShowTutorial?: () => void;
};

export const TeamRegistration: React.FC<TeamRegistrationProps> = ({ onShowTutorial }) => {
  const { registerTeam, gameState, registrationError, startTutorial } = useGame();
  const [teamName, setTeamName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName.trim()) {
      registerTeam(teamName.trim());
      setTeamName('');
    }
  };

  const handleShowTutorial = () => {
    // Prefer the full tutorial page if provided, fallback to interactive tour
    if (onShowTutorial) {
      onShowTutorial();
    } else {
      startTutorial();
    }
  };

  const handleStartTour = () => {
    startTutorial();
  };

  const isRoundActive = gameState.isActive;
  const canJoin = !isRoundActive;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/90 backdrop-blur-sm border-slate-700 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-slate-600 to-slate-800 rounded-2xl shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white mb-2">
            Join the Simulation
          </CardTitle>
          <CardDescription className="text-slate-400 text-base">
            {isRoundActive ? (
              <span className="text-orange-400 font-medium">
                ⚠️ A round is currently in progress. You can join after the current round ends.
              </span>
            ) : (
              "Enter your team name to participate in the Allotment Procurement & Demand Simulation"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" data-tutorial="team-registration">
            <div className="space-y-3">
              <Label htmlFor="teamName" className="text-slate-300 text-sm font-medium">Team Name</Label>
              <Input
                id="teamName"
                type="text"
                placeholder={isRoundActive ? "Please wait for current round to end..." : "Enter your team name"}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                disabled={isRoundActive}
                className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-slate-500 focus:ring-slate-400/30 text-lg min-h-[52px] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {registrationError && (
                <div className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {registrationError}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-slate-600 to-slate-800 hover:from-slate-700 hover:to-slate-900 text-white font-semibold text-lg min-h-[52px] rounded-xl shadow-lg transition-all duration-200 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed"
              disabled={!canJoin}
              data-tutorial="join-button"
            >
              {isRoundActive ? "Round in Progress - Please Wait" : "Join Game"}
            </Button>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={handleStartTour}
                variant="outline"
                className="flex-1 bg-gradient-to-r from-green-500/20 to-emerald-600/20 border-green-500/50 text-green-300 hover:bg-green-500/30 hover:text-green-200 font-medium min-h-[44px] rounded-xl transition-all duration-200"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                Take Tour
              </Button>
              <Button
                type="button"
                onClick={handleShowTutorial}
                variant="outline"
                className="flex-1 bg-slate-700/50 border-slate-500 text-white hover:bg-slate-600/50 font-medium min-h-[44px] rounded-xl transition-all duration-200"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                Show Tutorial
              </Button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-600">
            <div className="text-slate-300 text-sm font-medium mb-4">Current Teams:</div>
            {gameState.teams.length === 0 ? (
              <div className="text-slate-500 text-center py-4">No teams registered yet</div>
            ) : (
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {gameState.teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50 hover:bg-slate-700/50 transition-all duration-200"
                  >
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                    <span className="text-white font-medium">{team.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
