import { runAuction, initRuntime, runTick, finalize } from './engine';
import { defaultConfig } from './defaultConfig';
import { AuctionBid, Decision, MarketSnapshot, DayResults, FinalReport } from './types';

export type DemoResult = {
  auction: ReturnType<typeof runAuction>;
  timeline: Array<{ snapshot: MarketSnapshot; results: DayResults }>;
  finalReport: FinalReport[];
};

export function runDemoSimulation(): DemoResult {
  const config = defaultConfig;

  const bids: AuctionBid[] = config.teams.map((team, idx) => ({
    teamId: team.id,
    bid_price_per_seat: 150 - idx * 5,
    bid_quantity: 60,
  }));

  const auction = runAuction(config, bids);
  const runtime = initRuntime(config, auction);
  const timeline: Array<{ snapshot: MarketSnapshot; results: DayResults }> = [];

  for (let t = config.ticks_total; t >= 1; t -= 1) {
    const decisions: Decision[] = config.teams.map((team) => {
      const state = runtime.team[team.id];
      const priceTrend = state.last_price * (1 - 0.01 * (runtime.rng() - 0.5));
      return {
        teamId: team.id,
        price: Math.round(priceTrend),
        push_level: 0,
        fix_hold_pct: 0,
        tool: 'none',
      };
    });

    const { snapshot, results } = runTick(config, runtime, decisions);
    timeline.push({ snapshot, results });
  }

  const finalReport = finalize(config, runtime);
  return { auction, timeline, finalReport };
}
