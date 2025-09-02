import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Shield } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const { loginAsAdmin } = useGame();
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      loginAsAdmin(password.trim());
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-lg sm:text-xl">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
            Admin Login
          </CardTitle>
          <CardDescription className="text-sm">
            Enter admin password to control the simulation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-sm min-h-[44px]"
              />
            </div>

            <Button type="submit" className="w-full min-h-[44px]">
              Login as Admin
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="text-sm min-h-[44px]"
            >
              Back to Team Registration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
