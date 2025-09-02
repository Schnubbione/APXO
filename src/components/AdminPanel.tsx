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
    return (
      <div className="fixed top-4 right-4">
        <Button variant="outline" onClick={() => setIsAdmin(true)}>
          Admin
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <Card className="w-96 max-h-96 overflow-y-auto">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Admin Panel</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsAdmin(false)} className="absolute top-2 right-2">
            ✕
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Runden-Zeit (Minuten)</Label>
            <Slider value={[roundTime]} onValueChange={([v]) => setRoundTime(v)} min={1} max={30} step={1} />
            <div className="text-sm text-slate-600">{roundTime} Minuten</div>
          </div>

          <div className="space-y-2">
            <Label>Teams</Label>
            <Slider value={[numTeams]} onValueChange={([v]) => setNumTeams(v)} min={2} max={6} step={1} />
            <div className="text-sm text-slate-600">{numTeams} Teams</div>
          </div>

          <div className="space-y-2">
            <Label>Runden</Label>
            <Slider value={[rounds]} onValueChange={([v]) => setRounds(v)} min={1} max={12} step={1} />
            <div className="text-sm text-slate-600">{rounds} Runden</div>
          </div>

          <div className="space-y-2">
            <Label>Basis-Nachfrage</Label>
            <Slider value={[baseDemand]} onValueChange={([v]) => setBaseDemand(v)} min={20} max={240} step={5} />
            <div className="text-sm text-slate-600">~ {baseDemand} Kunden</div>
          </div>

          <div className="space-y-2">
            <Label>WTP-Streuung</Label>
            <Slider value={[spread]} onValueChange={([v]) => setSpread(v)} min={5} max={150} step={5} />
            <div className="text-sm text-slate-600">± {spread}</div>
          </div>

          <div className="space-y-2">
            <Label>Random Shock</Label>
            <Slider value={[Math.round(shock*100)]} onValueChange={([v]) => setShock(v/100)} min={0} max={40} step={1} />
            <div className="text-sm text-slate-600">± {Math.round(shock*100)}%</div>
          </div>

          <div className="space-y-2">
            <Label>Seed</Label>
            <Input type="number" value={seed} onChange={e => setSeed(parseInt(e.target.value||"0"))} />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={sharedMarket} onCheckedChange={setSharedMarket} id="shared" />
            <Label htmlFor="shared">Gemeinsamer Markt</Label>
          </div>

          <div className="flex gap-2">
            <Button onClick={onStartRound} size="sm">
              Neue Runde starten
            </Button>
            <Button onClick={onEndRound} variant="outline" size="sm">
              Runde beenden
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
