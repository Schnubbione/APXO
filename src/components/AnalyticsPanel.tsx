import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, Users, Target, BarChart3, PieChart as PieChartIcon, Activity, Award } from 'lucide-react';

interface AnalyticsPanelProps {
  showAnalytics: boolean;
  setShowAnalytics: (show: boolean) => void;
  gameState: any;
  roundHistory: any[];
  leaderboard: any[];
  onGetAnalytics?: () => void;
}

const COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function AnalyticsPanel({
  showAnalytics,
  setShowAnalytics,
  gameState,
  roundHistory,
  leaderboard,
  onGetAnalytics
}: AnalyticsPanelProps) {
  // Load analytics data when panel opens
  useEffect(() => {
    if (showAnalytics && onGetAnalytics) {
      onGetAnalytics();
    }
  }, [showAnalytics, onGetAnalytics]);
  if (!showAnalytics) return null;

  // Prepare data for charts
  const profitTrendData = roundHistory.map((round, index) => ({
    round: index + 1,
    ...round.reduce((acc: any, result: any) => {
      const teamName = gameState.teams.find((t: any) => t.id === result.teamId)?.name || `Team ${result.teamId}`;
      acc[teamName] = result.profit;
      return acc;
    }, {})
  }));

  const teamPerformanceData = gameState.teams.map((team: any, index: number) => ({
    name: team.name,
    profit: team.totalProfit,
    decisions: team.decisions,
    color: COLORS[index % COLORS.length]
  }));

  const demandData = roundHistory.map((round, index) => ({
    round: index + 1,
    totalDemand: round.reduce((sum: number, result: any) => sum + result.sold, 0),
    totalRevenue: round.reduce((sum: number, result: any) => sum + result.revenue, 0)
  }));

  // Heatmap data for decision patterns
  const decisionHeatmapData = gameState.teams.map((team: any) => ({
    team: team.name,
    fix: team.decisions.buy.F || 0,
    prorata: team.decisions.buy.P || 0,
    pooling: team.decisions.buy.O || 0,
    price: team.decisions.price
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-7xl max-h-[95vh] overflow-y-auto bg-slate-800/95 backdrop-blur-sm border-slate-600 shadow-2xl">
        <CardHeader className="pb-4 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600">
          <CardTitle className="text-xl sm:text-2xl text-white font-bold flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            Analytics Dashboard
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnalytics(false)}
            className="absolute top-3 right-3 h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg"
          >
            ✕
          </Button>
        </CardHeader>

        <CardContent className="p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-slate-700/50 border border-slate-600">
              <TabsTrigger value="overview" className="text-slate-300 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                <Activity className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="trends" className="text-slate-300 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                <TrendingUp className="w-4 h-4 mr-2" />
                Trends
              </TabsTrigger>
              <TabsTrigger value="performance" className="text-slate-300 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                <Users className="w-4 h-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="decisions" className="text-slate-300 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                <Target className="w-4 h-4 mr-2" />
                Decisions
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="text-slate-300 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                <Award className="w-4 h-4 mr-2" />
                Leaderboard
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-500/30">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Users className="w-6 h-6 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-white">Active Teams</h3>
                    </div>
                    <div className="text-3xl font-bold text-blue-400">{gameState.teams.length}</div>
                    <p className="text-slate-400 text-sm mt-2">Teams participating</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/20 to-green-600/20 border-green-500/30">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <TrendingUp className="w-6 h-6 text-green-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-white">Current Round</h3>
                    </div>
                    <div className="text-3xl font-bold text-green-400">{gameState.currentRound}</div>
                    <p className="text-slate-400 text-sm mt-2">Current Round</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-purple-500/30">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Target className="w-6 h-6 text-purple-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-white">Total Rounds</h3>
                    </div>
                    <div className="text-3xl font-bold text-purple-400">{roundHistory.length}</div>
                    <p className="text-slate-400 text-sm mt-2">Rounds completed</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-slate-700/30 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Demand & Revenue Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={demandData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="round" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="totalDemand"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="Total Demand"
                      />
                      <Line
                        type="monotone"
                        dataKey="totalRevenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Total Revenue (€)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-6 mt-6">
              <Card className="bg-slate-700/30 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Profit Trends Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={profitTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="round" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      {gameState.teams.map((team: any, index: number) => (
                        <Line
                          key={team.id}
                          type="monotone"
                          dataKey={team.name}
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-700/30 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Team Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={teamPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="profit" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-slate-700/30 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5" />
                      Profit Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={teamPerformanceData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: { name: string; percent?: number }) =>
                            `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="profit"
                        >
                          {teamPerformanceData.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="decisions" className="space-y-6 mt-6">
              <Card className="bg-slate-700/30 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Decision Patterns Heatmap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-600">
                          <th className="text-left text-slate-300 py-2">Team</th>
                          <th className="text-center text-slate-300 py-2">Price (€)</th>
                          <th className="text-center text-slate-300 py-2">Fix</th>
                          <th className="text-center text-slate-300 py-2">ProRata</th>
                          <th className="text-center text-slate-300 py-2">Pooling</th>
                        </tr>
                      </thead>
                      <tbody>
                        {decisionHeatmapData.map((team: any, _: number) => (
                          <tr key={team.team} className="border-b border-slate-700">
                            <td className="text-white py-3 font-medium">{team.team}</td>
                            <td className="text-center text-indigo-400 py-3 font-mono">{team.price}</td>
                            <td className="text-center py-3">
                              <div
                                className="w-8 h-8 mx-auto rounded flex items-center justify-center text-xs font-bold text-white"
                                style={{
                                  backgroundColor: `rgba(239, 68, 68, ${Math.min(team.fix / 50, 1)})`,
                                }}
                              >
                                {team.fix}
                              </div>
                            </td>
                            <td className="text-center py-3">
                              <div
                                className="w-8 h-8 mx-auto rounded flex items-center justify-center text-xs font-bold text-white"
                                style={{
                                  backgroundColor: `rgba(245, 158, 11, ${Math.min(team.prorata / 50, 1)})`,
                                }}
                              >
                                {team.prorata}
                              </div>
                            </td>
                            <td className="text-center py-3">
                              <div
                                className="w-8 h-8 mx-auto rounded flex items-center justify-center text-xs font-bold text-white"
                                style={{
                                  backgroundColor: `rgba(16, 185, 129, ${Math.min(team.pooling / 50, 1)})`,
                                }}
                              >
                                {team.pooling}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-6 mt-6">
              <Card className="bg-slate-700/30 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Historical Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {leaderboard.map((entry, index) => (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-700/30 to-slate-600/20 border border-slate-600/50 hover:from-slate-700/50 hover:to-slate-600/30 transition-all duration-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-lg">
                            #{index + 1}
                          </div>
                          <span className="font-semibold text-white text-lg">{entry.name}</span>
                        </div>
                        <div className="text-2xl font-bold text-green-400 tabular-nums">
                          €{entry.profit.toFixed(0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
