import {
  Allocation,
  AuctionBid,
  AuctionResult,
  Config,
  DayResults,
  Decision,
  FinalReport,
  MarketSnapshot,
  TeamId,
  TeamState,
  ToolChoice,
} from './types';

type RuntimeTeamState = TeamState & {
  last_price: number;
  fix_hold_quota: number;
  push_spend: number;
  tool_cooldown: number;
  tool_active: ToolChoice;
  attention_bonus: number;
  price_history: number[];
};

export type Runtime = {
  tick: number;
  P_airline: number;
  C_remain: number;
  team: Record<TeamId, RuntimeTeamState>;
  rng: () => number;
  sold_history: { teamId: TeamId; price: number; buy: number }[];
  forecastCum: number[];
  soldCum: number[];
  collusion_window: Array<{ prices: Record<TeamId, number> }>; // track last ticks for anti-collusion
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function runAuction(config: Config, bids: AuctionBid[]): AuctionResult {
  const C_total = config.airline.C_total;
  const sorted = [...bids].sort((a, b) => b.bid_price_per_seat - a.bid_price_per_seat);

  let capacity_left = C_total;
  const allocations: Allocation[] = [];

  for (const bid of sorted) {
    if (capacity_left <= 0) {
      allocations.push({ teamId: bid.teamId, awarded_fixed: 0, avg_fixed_cost: 0, fixed_costs_total: 0 });
      continue;
    }

    const requested = Math.max(0, Math.floor(bid.bid_quantity));
    if (requested === 0) {
      allocations.push({ teamId: bid.teamId, awarded_fixed: 0, avg_fixed_cost: 0, fixed_costs_total: 0 });
      continue;
    }

    const qty = Math.min(requested, capacity_left);
    const maxByBudget = bid.budget_cap && bid.bid_price_per_seat > 0
      ? Math.floor(bid.budget_cap / bid.bid_price_per_seat)
      : qty;
    const awarded = Math.max(0, Math.min(qty, maxByBudget));
    const costTotal = awarded * bid.bid_price_per_seat;

    allocations.push({
      teamId: bid.teamId,
      awarded_fixed: awarded,
      avg_fixed_cost: awarded > 0 ? bid.bid_price_per_seat : 0,
      fixed_costs_total: costTotal,
    });

    capacity_left -= awarded;
  }

  return { allocations, airline_capacity_used: C_total - capacity_left };
}

export function initRuntime(config: Config, auction: AuctionResult): Runtime {
  const rng = seededRng(config.rng_seed);
  const sumFixed = auction.allocations.reduce((acc, { awarded_fixed }) => acc + awarded_fixed, 0);
  const C_remain = Math.max(0, config.airline.C_total - sumFixed);

  const byTeam = new Map<TeamId, Allocation>();
  auction.allocations.forEach((allocation) => byTeam.set(allocation.teamId, allocation));

  const team: Record<TeamId, RuntimeTeamState> = {};
  for (const teamConfig of config.teams) {
    const allocation = byTeam.get(teamConfig.id) ?? { awarded_fixed: 0, avg_fixed_cost: 0, fixed_costs_total: 0 };
    const fixed_cost_total = allocation.fixed_costs_total ?? (allocation.awarded_fixed * allocation.avg_fixed_cost);

    team[teamConfig.id] = {
      teamId: teamConfig.id,
      fixed_left: allocation.awarded_fixed,
      avg_fixed_cost: allocation.awarded_fixed > 0 ? allocation.avg_fixed_cost : 0,
      price: teamConfig.P_start,
      revenue: 0,
      cost: fixed_cost_total,
      sales_fix: 0,
      sales_pool: 0,
      last_price: teamConfig.P_start,
      fix_hold_quota: 0,
      push_spend: 0,
      tool_cooldown: 0,
      tool_active: 'none',
      attention_bonus: 1,
      price_history: [],
    };
  }

  const forecastCum: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < config.ticks_total; i += 1) {
    cumulative += config.market.D_base[i] ?? 0;
    forecastCum.push(cumulative);
  }

  return {
    tick: config.ticks_total,
    P_airline: config.airline.P_airline_start,
    C_remain,
    team,
    rng,
    sold_history: [],
    forecastCum,
    soldCum: Array(config.ticks_total).fill(0),
    collusion_window: [],
  };
}

function demandEffective(config: Config, minPrice: number, tickIndex: number): number {
  const { D_base, alpha, P_ref } = config.market;
  const D0 = D_base[tickIndex] ?? 0;
  if (D0 <= 0) return 0;
  const ratio = (minPrice - P_ref) / Math.max(P_ref, 1e-6);
  const demand = D0 * Math.exp(-alpha * ratio);
  return Math.max(0, Math.round(demand));
}

function buildAttentionMultiplier(decision: Decision | undefined): number {
  if (!decision) return 1;
  switch (decision.push_level) {
    case 2: return 1.2;
    case 1: return 1.1;
    default: return 1.0;
  }
}

function applyToolEffects(tool: ToolChoice | undefined, baseAttention: number): { attention: number; extraCost: number } {
  switch (tool) {
    case 'spotlight':
      return { attention: baseAttention * 1.25, extraCost: 300 };
    case 'hedge':
      return { attention: baseAttention * 0.95, extraCost: 150 };
    case 'commit':
      return { attention: baseAttention * 1.05, extraCost: 100 };
    default:
      return { attention: baseAttention, extraCost: 0 };
  }
}

function computeLogitWeights(
  config: Config,
  runtime: Runtime,
  decisions: Decision[],
  minPrice: number,
  attention: Record<TeamId, number>,
): Map<TeamId, number> {
  const { beta } = config.market;
  const weights = new Map<TeamId, number>();
  for (const decision of decisions) {
    const team = runtime.team[decision.teamId];
    if (!team) continue;
    const effectivePrice = Math.max(decision.price, 1);
    const base = Math.exp(-beta * (effectivePrice / Math.max(minPrice, 1)));
    weights.set(decision.teamId, base * (attention[decision.teamId] ?? 1));
  }
  return weights;
}

function computeCollusionPenalty(
  config: Config,
  runtime: Runtime,
  decisions: Decision[],
): Record<TeamId, number> {
  const penalties: Record<TeamId, number> = {};
  const band = config.rules.anti_collusion_band_pct;
  if (band <= 0) return penalties;

  runtime.collusion_window.push({ prices: Object.fromEntries(decisions.map((d) => [d.teamId, d.price])) });
  if (runtime.collusion_window.length > 3) runtime.collusion_window.shift();
  if (runtime.collusion_window.length < 3) return penalties;

  const teams = decisions.map((d) => d.teamId);
  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const a = teams[i];
      const b = teams[j];
      const inBand = runtime.collusion_window.every(({ prices }) => {
        const pa = prices[a];
        const pb = prices[b];
        if (pa === undefined || pb === undefined) return false;
        if (pa === 0) return false;
        return Math.abs(pa - pb) / pa <= band;
      });
      if (inBand) {
        penalties[a] = Math.min(penalties[a] ?? 1, 0.9);
        penalties[b] = Math.min(penalties[b] ?? 1, 0.9);
      }
    }
  }
  return penalties;
}

function applyPushCosts(config: Config, runtime: Runtime, decisions: Decision[]): void {
  for (const decision of decisions) {
    const team = runtime.team[decision.teamId];
    if (!team) continue;
    const costs = config.rules.push_cost_per_level;
    const level = decision.push_level ?? 0;
    const pushCost = costs[level] ?? 0;
    if (pushCost > 0) {
      team.cost += pushCost;
      team.push_spend += pushCost;
    }
  }
}

function enforcePriceConstraints(config: Config, runtime: Runtime, decision: Decision): number {
  const teamCfg = config.teams.find((team) => team.id === decision.teamId);
  if (!teamCfg) return decision.price;
  const teamState = runtime.team[decision.teamId];
  const floor = teamCfg.P_floor;
  const ceil = teamCfg.P_ceil;
  let target = clamp(decision.price, floor, ceil);
  const threshold = config.rules.price_jump_threshold;
  const previous = teamState.last_price;
  if (previous > 0 && threshold > 0) {
    const maxChange = previous * threshold;
    if (Math.abs(target - previous) > maxChange) {
      target = previous + Math.sign(target - previous) * maxChange;
    }
  }
  return Math.round(target);
}

export function airlineReprice(config: Config, runtime: Runtime): number {
  const { P_min, P_max, gamma, kappa } = config.airline;
  const index = config.ticks_total - runtime.tick;
  const sold = runtime.soldCum[index] ?? 0;
  const forecast = runtime.forecastCum[index] ?? 0;
  const delta = sold - forecast;
  const factor = 1 + gamma * Math.tanh(delta / Math.max(kappa, 1e-6));
  return clamp(runtime.P_airline * factor, P_min, P_max);
}

export function runTick(
  config: Config,
  runtime: Runtime,
  decisions: Decision[],
): { snapshot: MarketSnapshot; results: DayResults } {
  if (runtime.tick <= 0) {
    throw new Error('No ticks remaining – runTick called after schedule end');
  }

  const sanitized: Decision[] = decisions.map((decision) => {
    const team = runtime.team[decision.teamId];
    if (!team) {
      throw new Error(`Unknown team: ${decision.teamId}`);
    }

    const price = enforcePriceConstraints(config, runtime, decision);
    const fix_hold_pct = clamp(decision.fix_hold_pct ?? 0, 0, 100);
    const tool_choice: ToolChoice = decision.tool ?? 'none';

    return {
      teamId: decision.teamId,
      price,
      push_level: decision.push_level ?? 0,
      fix_hold_pct,
      tool: tool_choice,
    };
  });

  const priceBoard = sanitized.map(({ teamId, price }) => ({ teamId, price }));
  const minPrice = Math.min(...priceBoard.map((entry) => entry.price));
  const tickIndex = config.ticks_total - runtime.tick;
  const demand = demandEffective(config, minPrice, tickIndex);

  const attention: Record<TeamId, number> = {};

  for (const decision of sanitized) {
    const team = runtime.team[decision.teamId];
    team.price_history.push(decision.price);
    team.last_price = decision.price;

    const base = buildAttentionMultiplier(decision);
    const toolState = team.tool_cooldown > 0 ? 'none' : decision.tool;
    const { attention: attBoost, extraCost } = applyToolEffects(toolState, base);
    attention[decision.teamId] = attBoost;

    team.tool_active = toolState;
    if (team.tool_cooldown > 0) team.tool_cooldown -= 1;
    if (toolState !== 'none') {
      team.tool_cooldown = config.rules.tool_cooldown_ticks;
      if (extraCost > 0) {
        team.cost += extraCost;
      }
    }
  }

  applyPushCosts(config, runtime, sanitized);
  const collusionPenalty = computeCollusionPenalty(config, runtime, sanitized);
  for (const teamId of Object.keys(collusionPenalty)) {
    attention[teamId] = (attention[teamId] ?? 1) * collusionPenalty[teamId];
  }

  const weights = computeLogitWeights(config, runtime, sanitized, minPrice, attention);
  const weightSum = Array.from(weights.values()).reduce((sum, value) => sum + value, 0) || 1;

  const fixQuota: Record<TeamId, number> = {};
  const quotaUsed: Record<TeamId, number> = {};
  for (const decision of sanitized) {
    const team = runtime.team[decision.teamId];
    fixQuota[decision.teamId] = Math.min(
      team.fixed_left,
      Math.floor(team.fixed_left * (1 - decision.fix_hold_pct / 100)),
    );
    quotaUsed[decision.teamId] = 0;
    team.fix_hold_quota = fixQuota[decision.teamId];
    team.price = decision.price;
  }

  const salesToday = new Map<TeamId, { sold_fix: number; sold_pool: number; revenue: number; cost: number }>();
  sanitized.forEach((decision) => {
    salesToday.set(decision.teamId, { sold_fix: 0, sold_pool: 0, revenue: 0, cost: 0 });
  });

  for (let n = 0; n < demand; n += 1) {
    let r = runtime.rng() * weightSum;
    let chosenTeamId: TeamId | undefined;
    for (const [teamId, w] of weights.entries()) {
      r -= w;
      if (r <= 0) {
        chosenTeamId = teamId;
        break;
      }
    }
    if (!chosenTeamId) chosenTeamId = sanitized[sanitized.length - 1]?.teamId ?? sanitized[0]?.teamId;
    if (!chosenTeamId) break;

    const decision = sanitized.find((d) => d.teamId === chosenTeamId)!;
    const team = runtime.team[chosenTeamId];
    const saleRecord = salesToday.get(chosenTeamId)!;

    const quota = fixQuota[chosenTeamId];
    const used = quotaUsed[chosenTeamId];

    if (quota > 0 && used < quota && team.fixed_left > 0) {
      quotaUsed[chosenTeamId] += 1;
      team.fixed_left -= 1;
      team.sales_fix += 1;
      team.revenue += decision.price;
      saleRecord.sold_fix += 1;
      saleRecord.revenue += decision.price;
      saleRecord.cost += team.avg_fixed_cost;
      runtime.sold_history.push({ teamId: chosenTeamId, price: decision.price, buy: team.avg_fixed_cost });
    } else if (runtime.C_remain > 0) {
      runtime.C_remain -= 1;
      team.sales_pool += 1;
      team.revenue += decision.price;
      team.cost += runtime.P_airline;
      saleRecord.sold_pool += 1;
      saleRecord.revenue += decision.price;
      saleRecord.cost += runtime.P_airline;
      runtime.sold_history.push({ teamId: chosenTeamId, price: decision.price, buy: runtime.P_airline });
    } else {
      // demand lost due to no capacity
    }
  }

  const demand_realized = Array.from(salesToday.values())
    .reduce((sum, entry) => sum + entry.sold_fix + entry.sold_pool, 0);
  const demand_lost = Math.max(0, demand - demand_realized);

  const previousSold = tickIndex > 0 ? runtime.soldCum[tickIndex - 1] : 0;
  runtime.soldCum[tickIndex] = previousSold + demand_realized;

  for (const [teamId, saleRecord] of salesToday) {
    const team = runtime.team[teamId];
    team.cost += saleRecord.cost;
  }

  const standings = Object.values(runtime.team)
    .map((teamState) => ({
      teamId: teamState.teamId,
      profit: teamState.revenue - teamState.cost,
    }))
    .sort((a, b) => b.profit - a.profit);

  const snapshot: MarketSnapshot = {
    tick: runtime.tick,
    P_airline: runtime.P_airline,
    C_remain: runtime.C_remain,
    price_board: priceBoard,
    demand_hint: minPrice < config.market.P_ref * 0.9 ? 'high'
      : minPrice > config.market.P_ref * 1.1 ? 'low'
        : 'med',
    standings,
  };

  const results: DayResults = {
    sales: Array.from(salesToday.entries()).map(([teamId, value]) => ({
      teamId,
      sold_fix: value.sold_fix,
      sold_pool: value.sold_pool,
      revenue: value.revenue,
      cost: value.cost,
    })),
    demand_realized,
    demand_lost,
    C_remain_after: runtime.C_remain,
  };

  runtime.tick -= 1;
  runtime.P_airline = airlineReprice(config, runtime);

  return { snapshot, results };
}

export function finalize(config: Config, runtime: Runtime): FinalReport[] {
  const reports: FinalReport[] = [];

  for (const teamState of Object.values(runtime.team)) {
    const sold = teamState.sales_fix + teamState.sales_pool;
    const sellTotal = runtime.sold_history
      .filter((entry) => entry.teamId === teamState.teamId)
      .reduce((sum, entry) => sum + entry.price, 0);
    const buyTotal = runtime.sold_history
      .filter((entry) => entry.teamId === teamState.teamId)
      .reduce((sum, entry) => sum + entry.buy, 0);
    const avgSellPrice = sold > 0 ? sellTotal / sold : 0;
    const avgBuyPrice = sold > 0 ? buyTotal / sold : 0;

    const emptyBeds = Math.max(config.hotel.capacity_per_team - sold, 0);
    const hotelPenalty = emptyBeds * config.hotel.penalty_empty_bed;

    const totalCost = teamState.cost + hotelPenalty;
    const profit = teamState.revenue - totalCost;

    reports.push({
      teamId: teamState.teamId,
      total_revenue: teamState.revenue,
      total_cost: totalCost,
      hotel_penalty: hotelPenalty,
      profit,
      avg_sell_price: avgSellPrice,
      avg_buy_price: avgBuyPrice,
      sold_total: sold,
      load_factor: config.airline.C_total > 0 ? sold / config.airline.C_total : 0,
      winner: false,
    });
  }

  const eligible = reports.filter((report) => !config.rules.need_price_above_cost
    || report.avg_sell_price >= report.avg_buy_price);
  const podium = eligible.length > 0 ? eligible : reports;
  podium.sort((a, b) => b.profit - a.profit);

  if (podium[0]) {
    const winner = podium[0].teamId;
    for (const report of reports) {
      report.winner = report.teamId === winner;
    }
  }

  return reports;
}

export function buildDemoTimeline(
  config: Config,
  runtime: Runtime,
  decisionBuilder: (params: { tick: number; runtime: Runtime }) => Decision[],
): FinalReport[] {
  for (let t = config.ticks_total; t >= 1; t -= 1) {
    const decisions = decisionBuilder({ tick: t, runtime });
    runTick(config, runtime, decisions);
  }
  return finalize(config, runtime);
}
