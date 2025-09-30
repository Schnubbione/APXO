import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Settings, TrendingUp, Users, Target, Activity, Award } from "lucide-react";
import { defaultConfig } from "@/lib/simulation/defaultConfig";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

interface AdminPanelProps {
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
  poolingMarketUpdateInterval: number;
  setPoolingMarketUpdateInterval: (value: number) => void;
  simulatedWeeksPerUpdate: number;
  setSimulatedWeeksPerUpdate: (value: number) => void;
  totalAircraftSeats: number;
  setTotalAircraftSeats: (value: number) => void;
  demandVolatility?: number;
  setDemandVolatility?: (value: number) => void;
  priceElasticity?: number;
  setPriceElasticity?: (value: number) => void;
  marketPriceElasticity?: number;
  setMarketPriceElasticity?: (value: number) => void;
  referencePrice?: number;
  setReferencePrice?: (value: number) => void;
  marketConcentration?: number;
  setMarketConcentration?: (value: number) => void;
  costVolatility?: number;
  setCostVolatility?: (value: number) => void;
  crossElasticity?: number;
  setCrossElasticity?: (value: number) => void;
  // Hotel beds multiplier
  hotelCapacityRatio?: number;
  setHotelCapacityRatio?: (value: number) => void;
  // Prices
  fixSeatPrice?: number;
  setFixSeatPrice?: (value: number) => void;
  poolingCost?: number;
  setPoolingCost?: (value: number) => void;
  hotelBedCost?: number;
  setHotelBedCost?: (value: number) => void;
  // Budget per team (same for all)
  perTeamBudget?: number;
  setPerTeamBudget?: (value: number) => void;
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  showAdminPanel: boolean;
  setShowAdminPanel: (value: boolean) => void;
  // Analytics data
  gameState: any; // kept for compatibility; may be used by callers
  roundHistory: any[];
  leaderboard: any[];
  onGetAnalytics?: () => void;
  onResetAllData?: () => void;
  onResetCurrentGame?: () => void;
}

export default function AdminPanel({
  baseDemand, setBaseDemand,
  spread, setSpread, shock, setShock, sharedMarket, setSharedMarket,
  seed, setSeed, roundTime, setRoundTime,
  poolingMarketUpdateInterval, setPoolingMarketUpdateInterval,
  simulatedWeeksPerUpdate, setSimulatedWeeksPerUpdate,
  totalAircraftSeats, setTotalAircraftSeats,
  demandVolatility, setDemandVolatility,
  priceElasticity, setPriceElasticity,
  marketPriceElasticity, setMarketPriceElasticity,
  referencePrice, setReferencePrice,
  marketConcentration, setMarketConcentration,
  costVolatility, setCostVolatility,
  crossElasticity, setCrossElasticity,
  hotelCapacityRatio, setHotelCapacityRatio,
  fixSeatPrice, setFixSeatPrice,
  poolingCost, setPoolingCost,
  hotelBedCost, setHotelBedCost,
  perTeamBudget, setPerTeamBudget,
  isAdmin, showAdminPanel, setShowAdminPanel,
  gameState: _gameState, roundHistory, leaderboard, onGetAnalytics,
  onResetAllData, onResetCurrentGame
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState("settings");
  const agentConfig = defaultConfig;
  const pushCosts = agentConfig.rules.push_cost_per_level.join(' / ');

  // Load analytics data when analytics tab is selected
  useEffect(() => {
    if (activeTab === "analytics" && onGetAnalytics) {
      onGetAnalytics();
    }
  }, [activeTab, onGetAnalytics]);

  if (!isAdmin || !showAdminPanel) {
    return null; // Don't render anything when not admin or panel is closed
  }

  // Prepare analytics data
  const profitTrendData = roundHistory.map((round, index) => ({
    round: index + 1,
    totalProfit: round.totalProfit || 0,
    totalRevenue: round.totalRevenue || 0,
    totalCost: round.totalCost || 0,
    avgPrice: round.avgPrice || 0
  }));

  const teamPerformanceData = leaderboard.map(team => ({
    name: team.name,
    profit: team.profit,
    marketShare: team.marketShare || 0,
    capacity: team.capacity || 0
  }));

  return (
    <div className="fixed inset-0 sm:inset-auto sm:top-4 sm:right-4 z-50 flex items-center justify-center sm:items-start sm:justify-end p-4">
      {/* Mobile Overlay */}
      <div className="absolute inset-0 bg-black/60 sm:hidden backdrop-blur-sm" onClick={() => setShowAdminPanel(false)} />

      <Card className="w-full max-w-sm sm:w-96 max-h-[95vh] sm:max-h-[600px] overflow-hidden relative bg-slate-800/95 backdrop-blur-sm border-slate-600 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
        {/* Sticky Header */}
        <CardHeader className="sticky top-0 z-10 pb-4 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600">
          <CardTitle className="text-lg sm:text-xl text-white font-bold">Admin Panel</CardTitle>
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdminPanel(false)}
              className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg"
            >
              ✕
            </Button>
          </div>
        </CardHeader>

        {/* Tab Navigation */}
        <div className="px-6 pt-4 border-b border-slate-600">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-700/50">
              <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:bg-slate-600">
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-slate-600">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto max-h-[calc(95vh-200px)] sm:max-h-[400px]">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="settings" className="mt-0">
            <CardContent className="space-y-5 p-6">
              <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-slate-200 text-sm font-semibold mb-2">Agent v1 Simulation Snapshot (Practice Mode)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-300">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Countdown updates · cadence (s)</div>
                    <div className="font-semibold text-white">{agentConfig.ticks_total} · {agentConfig.seconds_per_tick}s</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Airline Price</div>
                    <div className="font-semibold text-white">Start €{agentConfig.airline.P_airline_start} · Range €{agentConfig.airline.P_min}–€{agentConfig.airline.P_max}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Demand (α / β) · Reference Price</div>
                    <div className="font-semibold text-white">{agentConfig.market.alpha} / {agentConfig.market.beta} · €{agentConfig.market.P_ref}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Hotel &amp; Tools</div>
                    <div className="font-semibold text-white">Hotel penalty €{agentConfig.hotel.penalty_empty_bed} · Tool cooldown {agentConfig.rules.tool_cooldown_ticks} updates</div>
                    <div className="text-xs text-slate-400">Push-level costs: {pushCosts} €</div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  These values are supplied by <code>apxo.config.yaml</code>. Practice Mode and the engine unit tests use this configuration verbatim.
                </p>
              </div>

              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <div className="text-amber-100 text-sm font-semibold mb-1">Legacy Live-Session Controls</div>
                <p className="text-xs text-amber-200">
                  The settings below still drive the current Socket.IO gameplay loop. They remain available until the backend has been fully migrated to the Agent v1 engine.
                </p>
              </div>

              {/* Quick Actions (moved to top) */}
              <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-slate-300 text-sm font-semibold mb-2">Legacy Quick Actions</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="bg-slate-800/50 border-slate-600 text-slate-200 hover:bg-slate-700"
                      onClick={() => {
                        // Helpers
                        const irnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
                        const rr = (min: number, max: number, digits = 2) => Number((Math.random() * (max - min) + min).toFixed(digits));

                        setTotalAircraftSeats(irnd(600, 1400));
                        setBaseDemand(irnd(80, 240));
                        setDemandVolatility && setDemandVolatility(rr(0.05, 0.2));
                        setPriceElasticity && setPriceElasticity(rr(-2.7, -0.9));
                        setMarketPriceElasticity && setMarketPriceElasticity(rr(-1.8, -0.5));
                        setReferencePrice && setReferencePrice(irnd(170, 230));
                        setCrossElasticity && setCrossElasticity(rr(0.1, 0.6));
                        setMarketConcentration && setMarketConcentration(rr(0.5, 0.9));
                        setCostVolatility && setCostVolatility(rr(0.03, 0.1));
                        setShock( Number(rr(0.0, 0.3).toFixed(2)) );
                        setSpread(irnd(20, 120));
                        setSeed(irnd(1, 99999));
                        // hotelCapacityRatio random: allow >1
                        setHotelCapacityRatio && setHotelCapacityRatio(rr(0.4, 1.2));
                        (setSharedMarket && setSharedMarket(true));
                        // Prices
                        setFixSeatPrice && setFixSeatPrice(irnd(50, 80));
                        setPoolingCost && setPoolingCost(irnd(20, 60));
                        setHotelBedCost && setHotelBedCost(irnd(30, 70));
                        // Budget
                        setPerTeamBudget && setPerTeamBudget(irnd(15000, 40000));
                      }}
                    >
                      Randomize Legacy Parameters
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-slate-800/50 border-slate-600 text-slate-200 hover:bg-slate-700"
                      onClick={() => {
                        setTotalAircraftSeats(1000);
                        setBaseDemand(100);
                        setDemandVolatility && setDemandVolatility(0.1);
                        setPriceElasticity && setPriceElasticity(-1.5);
                        setMarketPriceElasticity && setMarketPriceElasticity(-0.9);
                        setReferencePrice && setReferencePrice(199);
                        setCrossElasticity && setCrossElasticity(0.3);
                        setMarketConcentration && setMarketConcentration(0.7);
                        setCostVolatility && setCostVolatility(0.05);
                        setShock(0.1);
                        setSpread(50);
                        setSeed(42);
                        setHotelCapacityRatio && setHotelCapacityRatio(0.6);
                        // Reset prices to sensible defaults
                        setFixSeatPrice && setFixSeatPrice(60);
                        setPoolingCost && setPoolingCost(90);
                        setHotelBedCost && setHotelBedCost(50);
                        setPerTeamBudget && setPerTeamBudget(20000);
                      }}
                    >
                      Restore Legacy Defaults
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Pre-Purchase Timer (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Applies only to the legacy pre-purchase countdown (1–30 minutes).</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[roundTime]} onValueChange={([v]) => setRoundTime(v)} min={1} max={30} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{roundTime} minutes for Pre-Purchase</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Pooling Update Interval (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Wirkt nur auf den bisherigen Pooling-Ticker des Legacy-Servers (1-10 Sekunden)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[poolingMarketUpdateInterval]} onValueChange={([v]) => setPoolingMarketUpdateInterval(v)} min={1} max={10} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{poolingMarketUpdateInterval} second{poolingMarketUpdateInterval !== 1 ? 's' : ''} = {poolingMarketUpdateInterval} day{poolingMarketUpdateInterval !== 1 ? 's' : ''}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Simulated Days per Update</Label>
                    <div className="text-xs text-slate-500 mt-1">How many days advance per market update during Simulation phase (1-7 days)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[simulatedWeeksPerUpdate]} onValueChange={([v]) => setSimulatedWeeksPerUpdate(v)} min={1} max={7} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{simulatedWeeksPerUpdate} day{simulatedWeeksPerUpdate !== 1 ? 's' : ''}</div>
                </div>

                {/* Market Simulation Parameters */}
                <div className="pt-2 border-t border-slate-700/50" />

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Market Size (Total Aircraft Seats)</Label>
                    <div className="text-xs text-slate-500 mt-1">Overall capacity baseline for the market</div>
                  </div>
                  <Input
                    type="number"
                    value={totalAircraftSeats === 0 ? '' : (totalAircraftSeats || '')}
                    onChange={e => {
                      const v = e.target.value;
                      const n = v === '' ? 0 : parseInt(v || '0');
                      setTotalAircraftSeats(n);
                    }}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 min-h-[44px] rounded-lg"
                  />
                </div>

                {/* Hotel Capacity Ratio Control */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Hotel Beds Multiplier</Label>
                    <div className="text-xs text-slate-500 mt-1">Defines total hotel beds as multiplier × Market Size (default 0.6; can be greater than 1)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider
                      value={[Math.round((((hotelCapacityRatio ?? _gameState?.hotelCapacityRatio ?? 0.6) as number) * 100))]}
                      onValueChange={([v]) => {
                        const ratio = Number((v/100).toFixed(2));
                        setHotelCapacityRatio && setHotelCapacityRatio(ratio);
                      }}
                      min={0} max={200} step={1} className="w-full"
                    />
                  </div>
                    <div className="text-sm text-slate-400 text-center">{Number((hotelCapacityRatio ?? _gameState?.hotelCapacityRatio ?? 0.6)).toFixed(2)} × Market Size</div>
                  {/* Preview: compute total beds and per-team */}
                  {(() => {
                    const ratio = Number(hotelCapacityRatio ?? _gameState?.hotelCapacityRatio ?? 0.6);
                    const totalSeats = Number(totalAircraftSeats || _gameState?.totalAircraftSeats || 1000);
                    const teamCount = Number(_gameState?.teams?.length || 0);
                    const totalBeds = Math.floor(totalSeats * ratio);
                    const perTeam = Number(_gameState?.hotelCapacityPerTeam ?? (teamCount > 0 ? Math.floor(totalBeds / teamCount) : 0));
                    return (
                      <div className="text-xs text-slate-500 text-center">Preview: total {totalBeds} beds, per team {perTeam} {teamCount > 0 ? `(for ${teamCount} teams)` : ''}</div>
                    );
                  })()}
                </div>

                {/* Price Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">Fix Seat Price (€)</Label>
                    <Input
                      type="number"
                      value={fixSeatPrice === 0 ? '' : (fixSeatPrice ?? _gameState?.fixSeatPrice ?? 60)}
                      onChange={e => setFixSeatPrice && setFixSeatPrice(Number(e.target.value || 0))}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 min-h-[44px] rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">Pooling Cost (€)</Label>
                    <Input
                      type="number"
                      value={poolingCost === 0 ? '' : (poolingCost ?? _gameState?.poolingCost ?? 30)}
                      onChange={e => setPoolingCost && setPoolingCost(Number(e.target.value || 0))}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 min-h-[44px] rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">Hotel Bed Cost (€)</Label>
                    <Input
                      type="number"
                      value={hotelBedCost === 0 ? '' : (hotelBedCost ?? _gameState?.hotelBedCost ?? 50)}
                      onChange={e => setHotelBedCost && setHotelBedCost(Number(e.target.value || 0))}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 min-h-[44px] rounded-lg"
                    />
                  </div>
                </div>

                {/* Budget Control */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Per-Team Budget (€)</Label>
                    <div className="text-xs text-slate-500 mt-1">Applies to both phases for every team. In the current simulation a negative margin larger than the budget will trigger immediate insolvency.</div>
                  </div>
                  <Input
                    type="number"
                    value={perTeamBudget === 0 ? '' : (perTeamBudget ?? _gameState?.perTeamBudget ?? 20000)}
                    onChange={e => setPerTeamBudget && setPerTeamBudget(Number(e.target.value || 0))}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 min-h-[44px] rounded-lg"
                  />
                </div>


                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Base Demand (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Average base demand level</div>
                  </div>
                  <Input
                    type="number"
                    value={baseDemand === 0 ? '' : (baseDemand || '')}
                    onChange={e => {
                      const v = e.target.value; const n = v === '' ? 0 : parseInt(v || '0');
                      setBaseDemand(n);
                    }}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 min-h-[44px] rounded-lg"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Demand Volatility (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Random variation in demand (0.00 - 0.50)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[Math.round(((demandVolatility ?? 0.1) * 100))]}
                            onValueChange={([v]) => setDemandVolatility && setDemandVolatility(Number((v/100).toFixed(2)))}
                            min={0} max={50} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{(demandVolatility ?? 0.1).toFixed(2)}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Price Elasticity (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Sensitivity of demand to price (-3.0 to -0.5)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[Math.round(((priceElasticity ?? -1.5) * 100))]}
                            onValueChange={([v]) => setPriceElasticity && setPriceElasticity(Number((v/100).toFixed(2)))}
                            min={-300} max={-50} step={5} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{(priceElasticity ?? -1.5).toFixed(2)}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Market Price Elasticity (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Overall demand reaction to market-wide prices (-2.0 to -0.3)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider
                      value={[Math.round(((marketPriceElasticity ?? -0.9) * 100))]}
                      onValueChange={([v]) => setMarketPriceElasticity && setMarketPriceElasticity(Number((v / 100).toFixed(2)))}
                      min={-200}
                      max={-30}
                      step={5}
                      className="w-full"
                    />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{(marketPriceElasticity ?? -0.9).toFixed(2)}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Reference Market Price (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Benchmark price level used in demand weighting</div>
                  </div>
                  <Input
                    type="number"
                    value={referencePrice === undefined ? '' : referencePrice}
                    onChange={e => setReferencePrice && setReferencePrice(Number(e.target.value || 0))}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 min-h-[44px] rounded-lg"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Cross Elasticity (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Substitution effect between teams (0.0 - 1.0)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[Math.round(((crossElasticity ?? 0.3) * 100))]}
                            onValueChange={([v]) => setCrossElasticity && setCrossElasticity(Number((v/100).toFixed(2)))}
                            min={0} max={100} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{(crossElasticity ?? 0.3).toFixed(2)}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Market Concentration (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Concentration/Competition in market (0.0 - 1.0)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[Math.round(((marketConcentration ?? 0.7) * 100))]}
                            onValueChange={([v]) => setMarketConcentration && setMarketConcentration(Number((v/100).toFixed(2)))}
                            min={0} max={100} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{(marketConcentration ?? 0.7).toFixed(2)}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Cost Volatility (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Random variation in costs (0.00 - 0.20)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[Math.round(((costVolatility ?? 0.05) * 100))]}
                            onValueChange={([v]) => setCostVolatility && setCostVolatility(Number((v/100).toFixed(2)))}
                            min={0} max={20} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{(costVolatility ?? 0.05).toFixed(2)}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Shock Intensity (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">External shocks impacting demand (0.00 - 1.00)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[Math.round(((shock ?? 0.1) * 100))]}
                            onValueChange={([v]) => setShock(Number((v/100).toFixed(2)))}
                            min={0} max={100} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{(shock ?? 0.1).toFixed(2)}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Spread (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Baseline price spread or variance (0 - 200)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[Math.round(spread ?? 50)]}
                            onValueChange={([v]) => setSpread(v)}
                            min={0} max={200} step={5} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{Math.round(spread ?? 50)}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Seed (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Reproducible simulations</div>
                  </div>
                  <Input
                    type="number"
                    value={seed === 0 ? "" : (seed || "")}
                    placeholder="0"
                    onChange={e => {
                      const value = e.target.value;
                      const numValue = value === "" ? 0 : parseInt(value || "0");
                      setSeed(numValue);
                    }}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 min-h-[44px] rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <Switch checked={sharedMarket} onCheckedChange={setSharedMarket} id="shared" className="data-[state=checked]:bg-indigo-500" />
                  <div>
                    <Label htmlFor="shared" className="text-slate-300 text-sm font-medium cursor-pointer">Shared Market (Legacy)</Label>
                    <div className="text-xs text-slate-500 mt-1">Toggle for market structure</div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="mt-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <h3 className="text-red-400 font-semibold text-sm mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Danger Zone
                  </h3>
                  <div className="space-y-3">
                    <Button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to reset the current game? This will keep high scores but clear all current game data.')) {
                          onResetCurrentGame?.();
                        }
                      }}
                      variant="outline"
                      className="w-full bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20 hover:border-red-500/50 font-medium"
                    >
                      Reset Current Game
                    </Button>
                    <Button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to reset ALL data? This will delete everything including high scores!')) {
                          onResetAllData?.();
                        }
                      }}
                      variant="outline"
                      className="w-full bg-red-600/10 border-red-600/30 text-red-400 hover:bg-red-600/20 hover:border-red-600/50 font-medium"
                    >
                      Reset All Data
                    </Button>
                  </div>
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="analytics" className="mt-0">
              <CardContent className="space-y-6 p-6">
                {/* Overview Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/50">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-slate-300">Total Rounds</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{roundHistory.length}</div>
                  </div>
                  <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-slate-300">Active Teams</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{leaderboard.length}</div>
                  </div>
                </div>

                {/* Profit Trend Chart */}
                {profitTrendData.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Profit Trend
                    </h3>
                    <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/50">
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={profitTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                          <XAxis dataKey="round" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #475569',
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="totalProfit" stroke="#10b981" strokeWidth={2} name="Total Profit" />
                          <Line type="monotone" dataKey="totalRevenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" />
                          <Line type="monotone" dataKey="totalCost" stroke="#ef4444" strokeWidth={2} name="Cost" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Team Performance */}
                {teamPerformanceData.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Award className="w-5 h-5" />
                      Team Performance
                    </h3>
                    <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/50">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={teamPerformanceData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                          <XAxis dataKey="name" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #475569',
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                          <Bar dataKey="profit" fill="#10b981" name="Profit" />
                          <Bar dataKey="marketShare" fill="#3b82f6" name="Market Share %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Leaderboard */}
                {leaderboard.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Leaderboard
                    </h3>
                    <div className="space-y-2">
                      {leaderboard.slice(0, 5).map((team, index) => (
                        <div key={team.name} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-yellow-500 text-black' :
                              index === 1 ? 'bg-gray-400 text-black' :
                              index === 2 ? 'bg-amber-600 text-white' :
                              'bg-slate-600 text-white'
                            }`}>
                              {index + 1}
                            </div>
                            <span className="text-white font-medium">{team.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-bold">${team.profit?.toLocaleString() || 0}</div>
                            <div className="text-xs text-slate-400">{(team.marketShare || 0).toFixed(1)}% market share</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}
