import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface AdminPanelProps {
  numTeams: number;
  setNumTeams: (value: number) => void;
  rounds: number;
  setRounds: (value: number) => void;
  baseDemand: number;
  setBaseDemand: (value: number) => void;
  spread: number;
  setSpread: (value: number) => void;
  shock: number;
  setShock: (value: number) => void;
  sharedMarket: boolean;
  setSharedMarket: (value: boolean) => void;
  seed: number;
  setSeed: (value: number) => void;
  onStartRound: () => void;
  onEndRound: () => void;
  roundTime: number;
  setRoundTime: (value: number) => void;
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
}

export default function AdminPanel({
  numTeams, setNumTeams, rounds, setRounds, baseDemand, setBaseDemand,
  spread, setSpread, shock, setShock, sharedMarket, setSharedMarket,
  seed, setSeed, onStartRound, onEndRound, roundTime, setRoundTime,
  isAdmin, setIsAdmin
}: AdminPanelProps) {
  if (!isAdmin) {
    return null; // Don't render anything when not admin
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:top-4 sm:right-4 z-50 flex items-center justify-center sm:items-start sm:justify-end p-4">
      {/* Mobile Overlay */}
      <div className="absolute inset-0 bg-black/60 sm:hidden backdrop-blur-sm" onClick={() => setIsAdmin(false)} />

      <Card className="w-full max-w-sm sm:w-96 max-h-[85vh] sm:max-h-96 overflow-y-auto relative bg-slate-800/95 backdrop-blur-sm border-slate-600 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
        <CardHeader className="pb-4 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600">
          <CardTitle className="text-lg sm:text-xl text-white font-bold">Admin Panel</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Einfach schließen; kein Reload nötig
              setIsAdmin(false);
            }}
            className="absolute top-3 right-3 h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg"
          >
            ✕
          </Button>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="space-y-3">
            <Label className="text-slate-300 text-sm font-medium">Round Time (Minutes)</Label>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[roundTime]} onValueChange={([v]) => setRoundTime(v)} min={1} max={30} step={1} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">{roundTime} minutes</div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 text-sm font-medium">Teams</Label>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[numTeams]} onValueChange={([v]) => setNumTeams(v)} min={2} max={6} step={1} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">{numTeams} teams active</div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 text-sm font-medium">Rounds</Label>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[rounds]} onValueChange={([v]) => setRounds(v)} min={1} max={12} step={1} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">{rounds} rounds</div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 text-sm font-medium">Base Demand</Label>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[baseDemand]} onValueChange={([v]) => setBaseDemand(v)} min={20} max={240} step={5} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">~ {baseDemand} customers</div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 text-sm font-medium">WTP Spread</Label>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[spread]} onValueChange={([v]) => setSpread(v)} min={5} max={150} step={5} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">± {spread}</div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 text-sm font-medium">Random Shock</Label>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[Math.round(shock*100)]} onValueChange={([v]) => setShock(v/100)} min={0} max={40} step={1} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">± {Math.round(shock*100)}%</div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 text-sm font-medium">Seed</Label>
            <Input
              type="number"
              value={seed}
              onChange={e => setSeed(parseInt(e.target.value||"0"))}
              className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 min-h-[44px] rounded-lg"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
            <Switch checked={sharedMarket} onCheckedChange={setSharedMarket} id="shared" className="data-[state=checked]:bg-indigo-500" />
            <Label htmlFor="shared" className="text-slate-300 text-sm font-medium cursor-pointer">Shared Market</Label>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={onStartRound}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold min-h-[48px] rounded-lg shadow-lg hover:shadow-green-500/25 transition-all duration-200"
            >
              Start New Round
            </Button>
            <Button
              onClick={onEndRound}
              variant="outline"
              className="flex-1 bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700/70 hover:text-white hover:border-slate-500 font-semibold min-h-[48px] rounded-lg transition-all duration-200"
            >
              End Round
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
