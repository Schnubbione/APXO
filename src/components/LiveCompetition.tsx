import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, TrendingDown, Minus, Crown, Medal, Award } from 'lucide-react';

interface LiveCompetitionProps {
  currentTeam: any;
  leaderboard: Array<{ name: string }>;
}

type RankedCompetitor = {
  name: string;
  rank: number;
};

export default function LiveCompetition({ currentTeam, leaderboard }: LiveCompetitionProps) {
  const [rankChange, setRankChange] = useState<number>(0);
  const [competitors, setCompetitors] = useState<RankedCompetitor[]>([]);
  const previousOrderRef = useRef<string[]>([]);

  useEffect(() => {
    if (!currentTeam || !leaderboard.length) return;

    const order = leaderboard.map(entry => entry.name);
    const currentRankIndex = order.findIndex(name => name === currentTeam.name);
    if (currentRankIndex === -1) return;

    const currentRank = currentRankIndex + 1;
    const previousOrder = previousOrderRef.current;
    const previousRankIndex = previousOrder.findIndex(name => name === currentTeam.name);
    const previousRank = previousRankIndex >= 0 ? previousRankIndex + 1 : currentRank;

    setRankChange(previousRank - currentRank);

    const topCompetitors = leaderboard
      .filter(entry => entry.name !== currentTeam.name)
      .map(entry => ({
        name: entry.name,
        rank: order.findIndex(name => name === entry.name) + 1
      }))
      .slice(0, 3);

    setCompetitors(topCompetitors);
    previousOrderRef.current = order;
  }, [leaderboard, currentTeam]);

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

  const currentRank = leaderboard.findIndex(team => team.name === currentTeam?.name) + 1;
  if (!currentTeam || !leaderboard.length || currentRank === 0) return null;

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
              <span
                className={`text-sm font-semibold ${
                  rankChange > 0 ? 'text-green-400' : rankChange < 0 ? 'text-red-400' : 'text-slate-400'
                }`}
              >
                {rankChange > 0 ? `+${rankChange}` : rankChange < 0 ? rankChange : '—'}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Positions refresh continuously—nudge your strategy to climb before the countdown reaches zero.
          </p>
        </div>

        {/* Top Competitors */}
        <div className="space-y-2">
          <h4 className="text-sm text-slate-400 font-medium">Top Competitors</h4>
          {competitors.length === 0 ? (
            <div className="text-xs text-slate-500 bg-slate-700/30 rounded-lg border border-slate-600/50 px-3 py-2">
              Waiting for more teams to join the fray.
            </div>
          ) : (
            competitors.map((competitor) => (
              <div
                key={competitor.name}
                className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-400">#{competitor.rank}</span>
                    {getRankIcon(competitor.rank)}
                  </div>
                  <span className="text-white font-medium">{competitor.name}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {competitor.rank < currentRank
                    ? 'Ahead of you'
                    : competitor.rank > currentRank
                      ? 'Behind you'
                      : 'Neck and neck'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Competition Insights */}
        <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
          <div className="text-sm text-slate-400 mb-2">Competition Insights</div>
          <div className="space-y-1 text-sm">
            {currentRank === 1 && (
              <div className="text-yellow-400 flex items-center gap-2">
                🏆 You're in the lead! Maintain steady margins to stay on top.
              </div>
            )}
            {currentRank === 2 && (
              <div className="text-gray-400 flex items-center gap-2">
                🥈 Close second! One smart adjustment could secure first place.
              </div>
            )}
            {currentRank === 3 && (
              <div className="text-amber-600 flex items-center gap-2">
                🥉 On the podium—keep pressure on the leaders.
              </div>
            )}
            {currentRank > 3 && currentRank <= leaderboard.length / 2 && (
              <div className="text-blue-400 flex items-center gap-2">
                📈 Solidly mid-pack. Focus on consistent, positive rounds to climb.
              </div>
            )}
            {currentRank > leaderboard.length / 2 && (
              <div className="text-orange-400 flex items-center gap-2">
                🚀 Plenty of runway left—watch the teams ahead and plan your comeback.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
