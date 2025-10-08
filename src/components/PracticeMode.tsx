import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { defaultConfig } from '@/lib/simulation/defaultConfig';
import { runAuction, initRuntime, runTick, finalize } from '@/lib/simulation/engine';
import type { AuctionBid, Decision, FinalReport } from '@/lib/simulation/types';

interface PracticeModeProps {
  onClose: () => void;
  humanTeamName: string;
}

type PracticeSummary = {
  report: FinalReport[];
  auction: ReturnType<typeof runAuction>;
};

const aiBid = (teamId: string, basePrice: number): AuctionBid => ({
  teamId,
  bid_price_per_seat: basePrice,
  bid_quantity: 60,
});

const aiDecision = (teamId: string, progress: number, runtimePrice: number): Decision => ({
  teamId,
  price: Math.max(99, Math.round(runtimePrice * (1 - 0.12 * progress))),
  push_level: 0,
  fix_hold_pct: 0,
  tool: 'none',
});

export function PracticeMode({ onClose, humanTeamName }: PracticeModeProps) {
  const [initialPrice, setInitialPrice] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  const [bidQuantity, setBidQuantity] = useState('');
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  const [running, setRunning] = useState(false);

  const config = useMemo(() => ({
    ...defaultConfig,
    teams: defaultConfig.teams.map((team, index) => ({
      ...team,
      id: index === 0 ? humanTeamName || team.id : team.id,
    })),
  }), [humanTeamName]);

  const parsePositiveNumber = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const startSimulation = () => {
    const parsedInitialPrice = parsePositiveNumber(initialPrice);
    const parsedBidPrice = parsePositiveNumber(bidPrice);
    const parsedBidQuantity = parsePositiveNumber(bidQuantity);

    if (parsedInitialPrice === null || parsedBidPrice === null || parsedBidQuantity === null) {
      return;
    }

    const bidQuantityInt = Math.max(1, Math.floor(parsedBidQuantity));
    setRunning(true);
    const bids: AuctionBid[] = [
      {
        teamId: config.teams[0].id,
        bid_price_per_seat: Math.max(50, parsedBidPrice),
        bid_quantity: bidQuantityInt,
      },
      aiBid(config.teams[1].id, 148),
      aiBid(config.teams[2].id, 142),
    ];

    const auction = runAuction(config, bids);
    const runtime = initRuntime(config, auction);
    const totalSteps = Math.max(1, config.ticks_total);

    for (let step = totalSteps; step >= 1; step -= 1) {
      const progress = (totalSteps - step) / totalSteps;
      const decisions: Decision[] = [
        {
          teamId: config.teams[0].id,
          price: Math.max(99, Math.round(parsedInitialPrice * (1 - 0.15 * progress))),
          push_level: 0,
          fix_hold_pct: 0,
          tool: 'none',
        },
        aiDecision(config.teams[1].id, progress, config.teams[1].P_start),
        aiDecision(config.teams[2].id, progress, config.teams[2].P_start),
      ];

      runTick(config, runtime, decisions);
    }

    const report = finalize(config, runtime);
    setSummary({ report, auction });
    setRunning(false);
  };

  const canStartSimulation = !running
    && parsePositiveNumber(initialPrice) !== null
    && parsePositiveNumber(bidPrice) !== null
    && parsePositiveNumber(bidQuantity) !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl bg-slate-900 text-white border border-slate-700 shadow-lg">
        <CardHeader>
          <CardTitle>Practice Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!summary && (
            <>
              <p className="text-sm text-slate-300">
                Runs a full Agent v1 simulation with two phases: a pay-as-bid auction followed by a continuous countdown to the departure day. Adjust your initial bid and starting price to explore the new mechanics.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-300">Initial Retail Price (€)</Label>
                  <Input
                    type="number"
                    value={initialPrice}
                    placeholder="199"
                    onChange={(event) => setInitialPrice(event.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Bid Price per Seat (€)</Label>
                  <Input
                    type="number"
                    value={bidPrice}
                    placeholder="150"
                    onChange={(event) => setBidPrice(event.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Bid Quantity</Label>
                  <Input
                    type="number"
                    value={bidQuantity}
                    placeholder="60"
                    onChange={(event) => setBidQuantity(event.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={startSimulation} disabled={!canStartSimulation} className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50">
                  {running ? 'Running…' : 'Start Simulation'}
                </Button>
                <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-200">
                  Close
                </Button>
              </div>
            </>
          )}

          {summary && (
            <div className="space-y-5">
              <div>
                <div className="text-sm text-slate-400 uppercase tracking-wide">Phase 1</div>
                <div className="text-lg font-semibold">Auction Result</div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {summary.auction.allocations.map((allocation) => (
                    <div key={allocation.teamId} className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                      <div className="text-sm text-slate-400">Team {allocation.teamId}</div>
                      <div className="text-xl font-semibold">{allocation.awarded_fixed} seats</div>
                      <div className="text-xs text-slate-500">Avg cost: €{allocation.avg_fixed_cost.toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-400 uppercase tracking-wide">Phase 2</div>
                <div className="text-lg font-semibold">Final Report</div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {summary.report.map((team) => (
                    <div key={team.teamId} className={`rounded-lg border ${team.winner ? 'border-emerald-400' : 'border-slate-700'} bg-slate-800/70 p-3`}>
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>Team {team.teamId}</span>
                        {team.winner && <span className="text-emerald-400 font-semibold">Winner</span>}
                      </div>
                      <div className="mt-2 text-xl font-semibold tabular-nums">€{Math.round(team.revenue)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Sold: {team.sold_total} &nbsp;|&nbsp; Load: {(team.load_factor * 100).toFixed(1)}%
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Profit: €{Math.round(team.profit)}</div>
                      <div className="mt-1 text-xs text-slate-500">Avg sell: €{team.avg_sell_price.toFixed(0)}</div>
                      <div className="mt-1 text-xs text-slate-500">Avg buy: €{team.avg_buy_price.toFixed(0)}</div>
                      <div className="mt-1 text-xs text-rose-400">Hotel penalty: €{team.hotel_penalty.toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setSummary(null)} className="bg-indigo-500 hover:bg-indigo-600">Run Again</Button>
                <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-200">Finish</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
export default PracticeMode;
