import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, TrendingDown, Minus, Crown, Medal, Award } from 'lucide-react';

interface LiveCompetitionProps {
  currentTeam: any;
  leaderboard: any[];
  roundResults: any[];
}

export default function LiveCompetition({ currentTeam, leaderboard, roundResults }: LiveCompetitionProps) {
  const [rankChange, setRankChange] = useState<number>(0);
  const [competitors, setCompetitors] = useState<any[]>([]);

  useEffect(() => {
    if (!currentTeam || !leaderboard.length) return;

    const currentRank = leaderboard.findIndex(team => team.name === currentTeam.name) + 1;
    const previousRoundResults = roundResults.slice(0, -1);
    const previousLeaderboard = calculatePreviousLeaderboard(previousRoundResults);

    const previousRank = previousLeaderboard.findIndex(team => team.name === currentTeam.name) + 1;
    setRankChange(previousRank - currentRank);

    // Get top 3 competitors (excluding current team)
    const topCompetitors = leaderboard
      .filter(team => team.name !== currentTeam.name)
      .slice(0, 3)
      .map(team => ({
        ...team,
        rank: leaderboard.findIndex(t => t.name === team.name) + 1
      }));

    setCompetitors(topCompetitors);
  }, [leaderboard, currentTeam, roundResults]);

  const calculatePreviousLeaderboard = (previousResults: any[]) => {
    if (!previousResults.length) return [];

    // Simple calculation - in real implementation this would be more sophisticated
    const teamProfit: { [key: string]: number } = {};

    previousResults.forEach(result => {
      const profitValue = typeof result.profit === 'number'
        ? result.profit
        : (Number(result.revenue ?? 0) - Number(result.cost ?? 0));

      teamProfit[result.teamId] = (teamProfit[result.teamId] || 0) + profitValue;
    });

    return Object.entries(teamProfit)
      .map(([teamId, profit]) => ({
        name: `Team ${teamId.slice(0, 4)}`, // Simplified team name
        profit
      }))
      .sort((a, b) => b.profit - a.profit);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-4 h-4 text-yellow-400" />;
      case 2:
        return <Medal className="w-4 h-4 text-gray-400" />;
      case 3:
        return <Award className="w-4 h-4 text-amber-600" />;
      default:
        return <Users className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRankChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getProfitFromEntry = (entry: any) => {
    if (!entry) return 0;
    if (typeof entry.profit === 'number') return entry.profit;
    const revenue = typeof entry.revenue === 'number' ? entry.revenue : 0;
    const purchaseCost = typeof entry.cost === 'number' ? entry.cost : 0;
    return revenue - purchaseCost;
  };

  const currentRank = leaderboard.findIndex(team => team.name === currentTeam.name) + 1;
  const currentTeamEntry = leaderboard.find(team => team.name === currentTeam.name);
  const currentProfit = getProfitFromEntry(currentTeamEntry);

  const moneyClass = (value: number) => (value >= 0 ? 'text-green-400' : 'text-red-400');

  if (!currentTeam || !leaderboard.length) return null;

  return (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 shadow-2xl hover:shadow-slate-900/20 transition-all duration-300">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl text-white">
          <div className="p-2 bg-slate-600/25 rounded-lg">
            <Users className="w-5 h-5 text-slate-200" />
          </div>
          Live Competition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Team Status */}
        <div className="bg-gradient-to-r from-slate-600/20 to-slate-700/20 rounded-lg p-4 border border-slate-600/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">#{currentRank}</span>
              <span className="text-white font-semibold">{currentTeam.name}</span>
              {getRankIcon(currentRank)}
            </div>
            <div className="flex items-center gap-1">
              {getRankChangeIcon(rankChange)}
              <span className={`text-sm font-semibold ${
                rankChange > 0 ? 'text-green-400' :
                rankChange < 0 ? 'text-red-400' : 'text-slate-400'
              }`}>
                {rankChange > 0 ? `+${rankChange}` :
                 rankChange < 0 ? rankChange : '—'}
              </span>
            </div>
          </div>
          <div className={`text-lg font-bold tabular-nums ${moneyClass(currentProfit)}`}>
            €{currentProfit.toFixed(0)}
          </div>
        </div>

        {/* Top Competitors */}
        <div className="space-y-2">
          <h4 className="text-sm text-slate-400 font-medium">Top Competitors</h4>
          {competitors.map((competitor) => (
            <div key={competitor.name} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-400">#{competitor.rank}</span>
                  {getRankIcon(competitor.rank)}
                </div>
                <span className="text-white font-medium">{competitor.name}</span>
              </div>
              <div className="text-right">
                <div className={`font-bold tabular-nums ${moneyClass(getProfitFromEntry(competitor))}`}>
                  €{getProfitFromEntry(competitor).toFixed(0)}
                </div>
                <div className="text-xs text-slate-500">
                  {competitor.rank < currentRank ? 'Ahead' :
                   competitor.rank > currentRank ? 'Behind' : 'Tied'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Competition Insights */}
        <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
          <div className="text-sm text-slate-400 mb-2">Competition Insights</div>
          <div className="space-y-1 text-sm">
            {currentRank === 1 && (
              <div className="text-yellow-400 flex items-center gap-2">
                🏆 You're in the lead! Maintain your advantage.
              </div>
            )}
            {currentRank === 2 && (
              <div className="text-gray-400 flex items-center gap-2">
                🥈 Close second! One strong round could put you on top.
              </div>
            )}
            {currentRank === 3 && (
              <div className="text-amber-600 flex items-center gap-2">
                🥉 On the podium! Keep pushing to reach the top.
              </div>
            )}
            {currentRank > 3 && currentRank <= leaderboard.length / 2 && (
              <div className="text-blue-400 flex items-center gap-2">
                📈 Good position! Focus on consistent profits.
              </div>
            )}
            {currentRank > leaderboard.length / 2 && (
              <div className="text-orange-400 flex items-center gap-2">
                🚀 Room for improvement! Study the leaders' strategies.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
