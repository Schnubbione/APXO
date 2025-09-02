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
  <div className="absolute inset-0 bg-black/50 sm:hidden" onClick={() => setIsAdmin(false)} />

      <Card className="w-full max-w-sm sm:w-96 max-h-[80vh] sm:max-h-96 overflow-y-auto relative">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">Admin Panel</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Einfach schließen; kein Reload nötig
              setIsAdmin(false);
            }}
            className="absolute top-2 right-2 h-8 w-8 p-0"
          >
            ✕
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Round Time (Minutes)</Label>
            <Slider value={[roundTime]} onValueChange={([v]) => setRoundTime(v)} min={1} max={30} step={1} />
            <div className="text-xs sm:text-sm text-slate-600">{roundTime} minutes</div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Teams</Label>
            <Slider value={[numTeams]} onValueChange={([v]) => setNumTeams(v)} min={2} max={6} step={1} />
            <div className="text-xs sm:text-sm text-slate-600">{numTeams} teams active</div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Rounds</Label>
            <Slider value={[rounds]} onValueChange={([v]) => setRounds(v)} min={1} max={12} step={1} />
            <div className="text-xs sm:text-sm text-slate-600">{rounds} rounds</div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Base Demand</Label>
            <Slider value={[baseDemand]} onValueChange={([v]) => setBaseDemand(v)} min={20} max={240} step={5} />
            <div className="text-xs sm:text-sm text-slate-600">~ {baseDemand} customers</div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">WTP Spread</Label>
            <Slider value={[spread]} onValueChange={([v]) => setSpread(v)} min={5} max={150} step={5} />
            <div className="text-xs sm:text-sm text-slate-600">± {spread}</div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Random Shock</Label>
            <Slider value={[Math.round(shock*100)]} onValueChange={([v]) => setShock(v/100)} min={0} max={40} step={1} />
            <div className="text-xs sm:text-sm text-slate-600">± {Math.round(shock*100)}%</div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Seed</Label>
            <Input
              type="number"
              value={seed}
              onChange={e => setSeed(parseInt(e.target.value||"0"))}
              className="text-sm min-h-[44px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={sharedMarket} onCheckedChange={setSharedMarket} id="shared" />
            <Label htmlFor="shared" className="text-sm">Shared Market</Label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={onStartRound} size="sm" className="flex-1 min-h-[44px]">
              Start New Round
            </Button>
            <Button onClick={onEndRound} variant="outline" size="sm" className="flex-1 min-h-[44px]">
              End Round
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
