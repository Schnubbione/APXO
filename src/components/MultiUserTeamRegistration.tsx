import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Users } from 'lucide-react';

export const TeamRegistration: React.FC = () => {
  const { registerTeam, gameState, registrationError } = useGame();
  const [teamName, setTeamName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName.trim()) {
      registerTeam(teamName.trim());
      setTeamName('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/90 backdrop-blur-sm border-slate-700 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white mb-2">
            Join the Simulation
          </CardTitle>
          <CardDescription className="text-slate-400 text-base">
            Enter your team name to participate in the Airline Procurement & Demand Simulation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" data-tutorial="team-registration">
            <div className="space-y-3">
              <Label htmlFor="teamName" className="text-slate-300 text-sm font-medium">Team Name</Label>
              <Input
                id="teamName"
                type="text"
                placeholder="Enter your team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 text-lg min-h-[52px] rounded-xl"
              />
              {registrationError && (
                <div className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {registrationError}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-lg min-h-[52px] rounded-xl shadow-lg transition-all duration-200"
              data-tutorial="join-button"
            >
              Join Game
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-600">
            <div className="text-slate-300 text-sm font-medium mb-4">Current Teams:</div>
            {gameState.teams.length === 0 ? (
              <div className="text-slate-500 text-center py-4">No teams registered yet</div>
            ) : (
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {gameState.teams.map((team) => (
                  <div key={team.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50 hover:bg-slate-700/50 transition-all duration-200">
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
