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
  roundTime: number;
  setRoundTime: (value: number) => void;
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  showAdminPanel: boolean;
  setShowAdminPanel: (value: boolean) => void;
}

export default function AdminPanel({
  numTeams, setNumTeams, rounds, setRounds, baseDemand, setBaseDemand,
  spread, setSpread, shock, setShock, sharedMarket, setSharedMarket,
  seed, setSeed, roundTime, setRoundTime,
  isAdmin, setIsAdmin, showAdminPanel, setShowAdminPanel
}: AdminPanelProps) {
  if (!isAdmin || !showAdminPanel) {
    return null; // Don't render anything when not admin or panel is closed
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:top-4 sm:right-4 z-50 flex items-center justify-center sm:items-start sm:justify-end p-4">
      {/* Mobile Overlay */}
      <div className="absolute inset-0 bg-black/60 sm:hidden backdrop-blur-sm" onClick={() => setShowAdminPanel(false)} />

      <Card className="w-full max-w-sm sm:w-96 max-h-[95vh] sm:max-h-[600px] overflow-y-auto relative bg-slate-800/95 backdrop-blur-sm border-slate-600 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
        <CardHeader className="pb-4 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600">
          <CardTitle className="text-lg sm:text-xl text-white font-bold">Admin Panel</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowAdminPanel(false);
            }}
            className="absolute top-3 right-3 h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg"
          >
            ✕
          </Button>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="space-y-3">
            <div>
              <Label className="text-slate-300 text-sm font-medium">Round Time</Label>
              <div className="text-xs text-slate-500 mt-1">Slider von 1-30 Minuten</div>
            </div>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[roundTime]} onValueChange={([v]) => setRoundTime(v)} min={1} max={30} step={1} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">{roundTime} minutes</div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-slate-300 text-sm font-medium">Teams</Label>
              <div className="text-xs text-slate-500 mt-1">Aktuelle Anzahl registrierter Teams</div>
            </div>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[numTeams]} onValueChange={([v]) => setNumTeams(v)} min={2} max={6} step={1} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">{numTeams} teams registered</div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-slate-300 text-sm font-medium">Rounds</Label>
              <div className="text-xs text-slate-500 mt-1">Gesamtanzahl der Runden (1-12)</div>
            </div>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[rounds]} onValueChange={([v]) => setRounds(v)} min={1} max={12} step={1} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">{rounds} rounds</div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-slate-300 text-sm font-medium">Base Demand</Label>
              <div className="text-xs text-slate-500 mt-1">Grundnachfrage (20-240 Kunden)</div>
            </div>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[baseDemand]} onValueChange={([v]) => setBaseDemand(v)} min={20} max={240} step={5} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">~ {baseDemand} customers</div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-slate-300 text-sm font-medium">WTP Spread</Label>
              <div className="text-xs text-slate-500 mt-1">Preisvariabilität (±5-150)</div>
            </div>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[spread]} onValueChange={([v]) => setSpread(v)} min={5} max={150} step={5} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">± {spread}</div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-slate-300 text-sm font-medium">Random Shock</Label>
              <div className="text-xs text-slate-500 mt-1">Zufällige Nachfrageschwankungen (±0-40%)</div>
            </div>
            <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <Slider value={[Math.round(shock*100)]} onValueChange={([v]) => setShock(v/100)} min={0} max={40} step={1} className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">± {Math.round(shock*100)}%</div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-slate-300 text-sm font-medium">Seed</Label>
              <div className="text-xs text-slate-500 mt-1">Reproduzierbare Simulationen</div>
            </div>
            <Input
              type="number"
              value={seed}
              onChange={e => setSeed(parseInt(e.target.value||"0"))}
              className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 min-h-[44px] rounded-lg"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
            <Switch checked={sharedMarket} onCheckedChange={setSharedMarket} id="shared" className="data-[state=checked]:bg-indigo-500" />
            <div>
              <Label htmlFor="shared" className="text-slate-300 text-sm font-medium cursor-pointer">Shared Market</Label>
              <div className="text-xs text-slate-500 mt-1">Toggle für Marktstruktur</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
