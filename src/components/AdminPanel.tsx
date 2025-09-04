import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Settings, TrendingUp, Users, Target, Activity, Award } from "lucide-react";
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
  numTeams: number;
  setNumTeams: (value: number) => void;
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
  numTeams, setNumTeams, baseDemand, setBaseDemand,
  spread, setSpread, shock, setShock, sharedMarket, setSharedMarket,
  seed, setSeed, roundTime, setRoundTime,
  poolingMarketUpdateInterval, setPoolingMarketUpdateInterval,
  simulatedWeeksPerUpdate, setSimulatedWeeksPerUpdate,
  totalAircraftSeats, setTotalAircraftSeats,
  isAdmin, showAdminPanel, setShowAdminPanel,
  gameState: _gameState, roundHistory, leaderboard, onGetAnalytics
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState("settings");

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
                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Phase Time</Label>
                    <div className="text-xs text-slate-500 mt-1">Time limit for both Pre-Purchase and Simulation phases (1-30 minutes)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[roundTime]} onValueChange={([v]) => setRoundTime(v)} min={1} max={30} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{roundTime} minutes per phase</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Teams</Label>
                    <div className="text-xs text-slate-500 mt-1">Current number of registered teams</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[numTeams]} onValueChange={([v]) => setNumTeams(v)} min={2} max={6} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{numTeams} teams registered</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Total Aircraft Seats</Label>
                    <div className="text-xs text-slate-500 mt-1">Total available seats across all aircraft (500-5000)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[totalAircraftSeats]} onValueChange={([v]) => setTotalAircraftSeats(v)} min={500} max={5000} step={100} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{totalAircraftSeats} total seats</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Base Demand</Label>
                    <div className="text-xs text-slate-500 mt-1">Base demand (20-240 customers)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[baseDemand]} onValueChange={([v]) => setBaseDemand(v)} min={20} max={240} step={5} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">~ {baseDemand} customers</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">WTP Spread</Label>
                    <div className="text-xs text-slate-500 mt-1">Price variability (±5-150)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[spread]} onValueChange={([v]) => setSpread(v)} min={5} max={150} step={5} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">± {spread}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Random Shock</Label>
                    <div className="text-xs text-slate-500 mt-1">Random demand fluctuations (±0-40%)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[Math.round(shock*100)]} onValueChange={([v]) => setShock(v/100)} min={0} max={40} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">± {Math.round(shock*100)}%</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Pooling Market Update Interval</Label>
                    <div className="text-xs text-slate-500 mt-1">How often the pooling market updates (1-10 seconds)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[poolingMarketUpdateInterval]} onValueChange={([v]) => setPoolingMarketUpdateInterval(v)} min={1} max={10} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{poolingMarketUpdateInterval} second{poolingMarketUpdateInterval !== 1 ? 's' : ''} = {poolingMarketUpdateInterval} day{poolingMarketUpdateInterval !== 1 ? 's' : ''}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Simulated Days per Update</Label>
                    <div className="text-xs text-slate-500 mt-1">How many days advance per market update (1-7 days)</div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                    <Slider value={[simulatedWeeksPerUpdate]} onValueChange={([v]) => setSimulatedWeeksPerUpdate(v)} min={1} max={7} step={1} className="w-full" />
                  </div>
                  <div className="text-sm text-slate-400 text-center">{simulatedWeeksPerUpdate} day{simulatedWeeksPerUpdate !== 1 ? 's' : ''}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm font-medium">Seed</Label>
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
                    <Label htmlFor="shared" className="text-slate-300 text-sm font-medium cursor-pointer">Shared Market</Label>
                    <div className="text-xs text-slate-500 mt-1">Toggle for market structure</div>
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
