import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Users } from 'lucide-react';

export const TeamRegistration: React.FC = () => {
  const { registerTeam, gameState } = useGame();
  const [teamName, setTeamName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName.trim()) {
      registerTeam(teamName.trim());
      setTeamName('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-lg sm:text-xl">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            Join the Simulation
          </CardTitle>
          <CardDescription className="text-sm">
            Enter your team name to participate in the Airline Procurement & Demand Simulation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName" className="text-sm">Team Name</Label>
              <Input
                id="teamName"
                type="text"
                placeholder="Enter your team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                className="text-sm min-h-[44px]"
              />
            </div>

            <Button type="submit" className="w-full min-h-[44px]">
              Join Game
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t">
            <div className="text-sm text-slate-600">
              <div className="font-medium mb-2">Current Teams:</div>
              {gameState.teams.length === 0 ? (
                <div className="text-slate-500 text-sm">No teams registered yet</div>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {gameState.teams.map((team) => (
                    <div key={team.id} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      {team.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
