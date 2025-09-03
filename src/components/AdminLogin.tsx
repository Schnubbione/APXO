import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Shield, Lightbulb } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const { loginAsAdmin, isAdmin, startTutorial, adminLoginError } = useGame();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      setLoading(true);
      loginAsAdmin(password.trim());
      setPassword('');
      // Reset loading after a short delay
      setTimeout(() => setLoading(false), 2000);
    }
  };

  const handleStartTour = () => {
    startTutorial();
  };

  // If admin login was successful, this component won't be rendered anymore
  // because the parent component will show the admin view instead

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/90 backdrop-blur-sm border-slate-700 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white mb-2">
            Admin Login
          </CardTitle>
          <CardDescription className="text-slate-400 text-base">
            Enter admin password to control the simulation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="password" className="text-slate-300 text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 text-lg min-h-[52px] rounded-xl"
                disabled={loading}
              />
              {adminLoginError && <p className="text-sm text-red-400 font-medium">{adminLoginError}</p>}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-lg min-h-[52px] rounded-xl shadow-lg transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Logging in...
                </span>
              ) : (
                'Login as Admin'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={handleStartTour}
                variant="outline"
                className="flex-1 bg-slate-700/50 border-slate-500 text-white hover:bg-slate-600/50 font-medium min-h-[44px] rounded-lg transition-all duration-200"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                Take Tour
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700/70 hover:text-white hover:border-slate-500 min-h-[44px] rounded-lg transition-all duration-200"
            >
              ← Back to Team Registration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
