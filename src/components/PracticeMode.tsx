import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useGame } from '@/contexts/GameContext';

type PracticeTeam = {
  id: number;
  name: string;
  decisions: {
    price: number;
    buy: { F: number; P: number; O: number };
    fixSeatsPurchased?: number; // for parity with server model
    fixSeatsAllocated?: number;
    poolingAllocation: number; // percent 0..100
    hotelCapacity?: number;
  };
  totalProfit: number;
};

type PracticeSettings = {
  baseDemand: number;
  demandVolatility: number;
  priceElasticity: number; // negative
  marketConcentration: number;
  totalAircraftSeats: number;
  fixSeatPrice: number;
  hotelBedCost: number;
  costVolatility: number;
  poolingMarket?: { currentPrice: number };
  // No more fare classes - simplified to Fix Seats + Pooling only
};

export function PracticeMode({
  onClose,
  humanTeamName,
}: {
  onClose: () => void;
  humanTeamName: string;
}) {
  const { startPracticeMode, practice } = useGame();
  const [teams, setTeams] = useState<PracticeTeam[]>([]);
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [results, setResults] = useState<any[] | null>(null);
  const [initialPrice, setInitialPrice] = useState<number>(199);
  const [hasStarted, setHasStarted] = useState(false);

  // Init random scenario
  useEffect(() => {
    // Reset local UI state on open
    setResults(null);
    setHasStarted(false);
  }, [humanTeamName]);

  // Update human initial price before start
  useEffect(() => {
    if (!teams.length) return;
    setTeams(prev => prev.map(t => t.id === 1 ? { ...t, decisions: { ...t.decisions, price: initialPrice } } : t));
  }, [initialPrice]);

  const startAndRun = async () => {
    setHasStarted(true);
    startPracticeMode({ rounds: 3, overridePrice: initialPrice });
  };

  // When server sends results, show them
  useEffect(() => {
    if (practice && 'running' in practice && !practice.running && (practice as any).results) {
      const payload: any = (practice as any).results;
      setSettings(payload.settings);
      // Convert ids to consistent types
      const last = payload.rounds[payload.rounds.length - 1]?.teamResults || [];
      setResults(last);
    }
  }, [practice]);

  // Leaderboard is provided by server via practice.results.leaderboard

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-slate-800/95 border-slate-600 text-white">
        <CardHeader>
          <CardTitle>Practice Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!hasStarted && (
            <div className="space-y-4">
              <div className="text-slate-300 text-sm">
                Compete against AI teams with realistic strategies. Practice all game mechanics including:
                <br/>• Fix Seat allocation and Pooling market usage
                <br/>• Hotel capacity management and costs
                <br/>• Dynamic pricing and market share competition
                <br/>Rounds start automatically; parameters are randomized for each session.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300 text-sm">Your Initial Price (€)</Label>
                  <Input type="number" value={initialPrice} onChange={e => setInitialPrice(Number(e.target.value || 0))}
                         className="bg-slate-700/50 border-slate-600 text-white"/>
                </div>
                <div className="text-sm text-slate-400">
                  Opponents: {teams.length > 0 ? teams.length - 1 : '—'}
                  <br/>Base Demand: {settings?.baseDemand ?? '—'}
                  <br/>Aircraft Seats: {settings?.totalAircraftSeats ?? '—'}
                  <br/>Hotel Beds/Team: {settings && teams.length > 0 ? Math.floor((settings.totalAircraftSeats || 1000) * 0.6 / teams.length) : '—'}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={startAndRun} className="bg-gradient-to-r from-indigo-500 to-purple-600">Start Practice</Button>
                <Button variant="outline" onClick={onClose} className="border-slate-500 text-slate-200">Close</Button>
              </div>
            </div>
          )}

          {hasStarted && (!results) && (
            <div className="text-slate-300">Running simulation…</div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="text-lg font-semibold">Practice Session Summary</div>
              
              {/* Market Overview */}
              <div className="p-3 bg-slate-700/30 rounded border border-slate-600">
                <div className="text-sm font-medium text-slate-300 mb-2">Market Conditions</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div>Total Aircraft Seats: {settings?.totalAircraftSeats}</div>
                  <div>Base Demand: {settings?.baseDemand}</div>
                  <div>Hotel Beds/Team: {settings && results.length > 0 ? Math.floor((settings.totalAircraftSeats || 1000) * 0.6 / results.length) : '—'}</div>
                  <div>Fix Seat Price: €{settings?.fixSeatPrice}</div>
                </div>
              </div>
              
              {/* Team Results */}
              <div className="text-lg font-semibold">Team Performance</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map(r => (
                  <div key={r.teamId} className="p-3 bg-slate-700/40 rounded border border-slate-600">
                    <div className="font-medium">{String(r.teamName || r.teamId)}</div>
                    <div className="text-sm text-slate-300">
                      Sold: {r.sold} | Demand: {r.demand} | Capacity: {r.capacity}
                    </div>
                    <div className="text-sm text-slate-400">
                      Price: €{r.avgPrice || r.price} | Market Share: {(r.marketShare * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-green-400">Profit: €{r.profit}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-2">Leaderboard</div>
                <div className="space-y-2">
                  {(practice as any)?.results?.leaderboard?.map((e: any, i: number) => (
                    <div key={e.name} className="flex items-center justify-between p-2 bg-slate-700/40 rounded border border-slate-600">
                      <div className="flex items-center gap-2"><span className="w-6 text-center">{i + 1}.</span>{e.name}</div>
                      <div className="font-semibold text-green-400">€{Number(e.profit).toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={onClose} className="bg-gradient-to-r from-indigo-500 to-purple-600">Finish</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ================= Client-only logic remain for fallback/local testing (unused when server connected) =================
// Fallback round calculation removed (server provides results)

// removed unused helper
// other fallback helpers removed (server authoritative)

// deterministic RNG helper removed (unused)

export default PracticeMode;
