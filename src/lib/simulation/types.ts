// TypeScript definitions for the Allotment Procurement & Demand Simulation (Agent v1)
// These interfaces are designed to be shared between the frontend (React) and backend services.

export type TeamId = string;

export interface Config {
  ticks_total: number;
  seconds_per_tick: number;
  rng_seed: number;
  airline: {
    C_total: number;
    P_airline_start: number;
    P_min: number;
    P_max: number;
    gamma: number;
    kappa: number;
  };
  market: {
    D_base: number[]; // length must equal ticks_total
    alpha: number;
    beta: number;
    P_ref: number;
  };
  hotel: {
    capacity_per_team: number;
    penalty_empty_bed: number;
  };
  teams: {
    id: TeamId;
    P_start: number;
    P_floor: number;
    P_ceil: number;
  }[];
  rules: {
    need_price_above_cost: boolean;
    push_cost_per_level: [number, number, number];
    tool_cooldown_ticks: number;
    price_jump_threshold: number;
    anti_collusion_band_pct: number;
  };
}

/** -------- Phase 1: Auction -------- */

export interface AuctionBid {
  teamId: TeamId;
  bid_price_per_seat: number; // maximum willingness to pay per fixed seat (€)
  bid_quantity: number;       // desired fixed-seat quantity
  budget_cap?: number;        // optional budget ceiling (soft check)
}

export interface Allocation {
  teamId: TeamId;
  awarded_fixed: number;
  avg_fixed_cost: number;
  fixed_costs_total: number;
}

export interface AllocationSummary extends Allocation {
  teamName?: string;
}

export interface AuctionResult {
  allocations: Allocation[];
  airline_capacity_used: number;
}

/** -------- Phase 2: Live-Market Ticks -------- */

export type ToolChoice = 'none' | 'hedge' | 'spotlight' | 'commit';

export interface Decision {
  teamId: TeamId;
  price: number;              // retail price P_i(t)
  push_level: 0 | 1 | 2;      // modifies attention multiplier
  fix_hold_pct: number;       // 0..100: share of fixed seats intentionally held back
  tool?: ToolChoice;
}

export interface TeamState {
  teamId: TeamId;
  fixed_left: number;         // fixed seats remaining
  avg_fixed_cost: number;     // average fixed-seat cost (for reporting)
  price: number;              // current retail price
  revenue: number;
  cost: number;
  sales_fix: number;
  sales_pool: number;
}

export interface MarketSnapshot {
  tick: number;               // counts down from ticks_total to 1
  P_airline: number;
  C_remain: number;
  price_board: { teamId: TeamId; price: number }[];
  demand_hint: 'low' | 'med' | 'high';
  standings: { teamId: TeamId; profit: number }[];
}

export interface DayResults {
  sales: {
    teamId: TeamId;
    sold_fix: number;
    sold_pool: number;
    revenue: number;
    cost: number;
  }[];
  demand_realized: number;
  demand_lost: number;
  C_remain_after: number;
}

export interface FinalReport {
  teamId: TeamId;
  total_revenue: number;
  total_cost: number;
  hotel_penalty: number;
  profit: number;
  avg_sell_price: number;
  avg_buy_price: number;
  sold_total: number;
  load_factor: number; // sold seats divided by airline total capacity
  winner: boolean;
}
