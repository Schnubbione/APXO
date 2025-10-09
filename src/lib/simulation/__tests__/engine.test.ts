import { describe, expect, it } from '@jest/globals';
import { runAuction, initRuntime, runTick, finalize, airlineReprice } from '@/lib/simulation/engine';
import type { AuctionBid, Decision } from '@/lib/simulation/types';

describe('Agent v1 simulation engine', () => {
  const cloneConfig = () => ({
  ticks_total: 12,
  seconds_per_tick: 60,
  rng_seed: 42,
  airline: {
    C_total: 180,
    P_airline_start: 120,
    P_min: 80,
    P_max: 400,
    gamma: 0.15,
    kappa: 50,
  },
  market: {
    D_base: [6, 7, 8, 10, 12, 16, 20, 26, 34, 44, 58, 79],
    alpha: 1.1,
    beta: 6,
    P_ref: 150,
  },
  teams: [
    { id: 'A', P_start: 199, P_floor: 99, P_ceil: 499 },
    { id: 'B', P_start: 189, P_floor: 99, P_ceil: 499 },
    { id: 'C', P_start: 209, P_floor: 99, P_ceil: 499 },
  ],
  rules: {
    need_price_above_cost: true,
    push_cost_per_level: [0, 200, 600],
    tool_cooldown_ticks: 3,
    price_jump_threshold: 0.1,
    anti_collusion_band_pct: 0.01,
  },
});

  it('allocates auction seats by descending bid price (pay-as-bid)', () => {
    const config = cloneConfig();
    const bids: AuctionBid[] = [
      { teamId: config.teams[0].id, bid_price_per_seat: 140, bid_quantity: 70 },
      { teamId: config.teams[1].id, bid_price_per_seat: 160, bid_quantity: 70 },
      { teamId: config.teams[2].id, bid_price_per_seat: 150, bid_quantity: 70 },
    ];

    const result = runAuction(config, bids);
    const [first, second, third] = result.allocations;

    expect(first.teamId).toBe(config.teams[1].id);
    expect(second.teamId).toBe(config.teams[2].id);
    expect(third.teamId).toBe(config.teams[0].id);
    expect(first.awarded_fixed + second.awarded_fixed + third.awarded_fixed).toBeLessThanOrEqual(config.airline.C_total);
  });

  it('sells fix inventory before resorting to pooling seats', () => {
    const config = cloneConfig();
    const bids: AuctionBid[] = config.teams.map((team) => ({
      teamId: team.id,
      bid_price_per_seat: 150,
      bid_quantity: 20,
    }));
    const auction = runAuction(config, bids);
    const runtime = initRuntime(config, auction);
    runtime.forecastCum = Array(config.ticks_total).fill(0);

    const decisions: Decision[] = config.teams.map((team) => ({
      teamId: team.id,
      price: 130,
      push_level: 0,
      fix_hold_pct: 0,
      tool: 'none',
    }));

    const { results } = runTick(config, runtime, decisions);
    const salesForTeam = results.sales.find((entry) => entry.teamId === config.teams[0].id);

    expect(salesForTeam?.sold_fix ?? 0).toBeGreaterThan(0);
    expect(runtime.team[config.teams[0].id].sales_fix).toBeGreaterThan(0);
  });

  it('adjusts airline price upward when sales exceed forecast', () => {
    const config = cloneConfig();
    const bids: AuctionBid[] = config.teams.map((team) => ({
      teamId: team.id,
      bid_price_per_seat: 0,
      bid_quantity: 0,
    }));
    const auction = runAuction(config, bids);
    const runtime = initRuntime(config, auction);

    const index = 1;
    runtime.tick = config.ticks_total - index;
    runtime.soldCum[index] = 120;
    runtime.forecastCum[index] = 10;

    const nextPrice = airlineReprice(config, runtime);
    expect(nextPrice).toBeGreaterThan(runtime.P_airline);
  });

  it('only crowns winner when average sell price covers average buy price', () => {
    const config = cloneConfig();
    const bids: AuctionBid[] = config.teams.map((team) => ({
      teamId: team.id,
      bid_price_per_seat: 120,
      bid_quantity: 10,
    }));
    const auction = runAuction(config, bids);
    const runtime = initRuntime(config, auction);

    let aggressiveDecision: Decision = {
      teamId: config.teams[0].id,
      price: 50,
      push_level: 0,
      fix_hold_pct: 0,
      tool: 'none',
    };
    const rivalDecision: Decision = {
      teamId: config.teams[1].id,
      price: 200,
      push_level: 0,
      fix_hold_pct: 0,
      tool: 'none',
    };
    const neutralDecision: Decision = {
      teamId: config.teams[2].id,
      price: 190,
      push_level: 0,
      fix_hold_pct: 0,
      tool: 'none',
    };

    for (let tick = config.ticks_total; tick >= 1; tick -= 1) {
      runTick(config, runtime, [aggressiveDecision, rivalDecision, neutralDecision]);
      aggressiveDecision = { ...aggressiveDecision, price: aggressiveDecision.price * 0.98 };
    }

    const report = finalize(config, runtime);
    const winner = report.find((entry) => entry.winner);
    expect(winner).toBeDefined();
    expect(winner?.avg_sell_price).toBeGreaterThanOrEqual(winner?.avg_buy_price ?? 0);
  });
});
