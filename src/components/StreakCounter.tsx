import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, TrendingUp, Target, Award } from 'lucide-react';

interface StreakCounterProps {
  currentTeam: any;
  roundResults: any[];
}

export default function StreakCounter({ currentTeam, roundResults }: StreakCounterProps) {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [streakBonus, setStreakBonus] = useState(0);

  useEffect(() => {
    if (!currentTeam || !roundResults.length) return;

    const teamResults = roundResults.filter(r => r.teamId === currentTeam.id);
    let streak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    // Calculate current streak and best streak
    for (let i = teamResults.length - 1; i >= 0; i--) {
      if (teamResults[i].profit > 0) {
        tempStreak++;
        if (i === teamResults.length - 1) {
          streak = tempStreak; // Current streak
        }
      } else {
        maxStreak = Math.max(maxStreak, tempStreak);
        tempStreak = 0;
      }
    }
    maxStreak = Math.max(maxStreak, tempStreak);

    setCurrentStreak(streak);
    setBestStreak(Math.max(bestStreak, maxStreak));

    // Calculate streak bonus (increases with longer streaks)
    const bonus = Math.min(streak * 2, 20); // Max 20% bonus
    setStreakBonus(bonus);
  }, [roundResults, currentTeam]);

  const getStreakColor = (streak: number) => {
    if (streak >= 5) return 'text-red-400';
    if (streak >= 3) return 'text-orange-400';
    if (streak >= 2) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const getStreakIcon = (streak: number) => {
    if (streak >= 5) return <Flame className="w-6 h-6 text-red-400 animate-pulse" />;
    if (streak >= 3) return <TrendingUp className="w-6 h-6 text-orange-400" />;
    if (streak >= 2) return <Target className="w-6 h-6 text-yellow-400" />;
    return <Award className="w-6 h-6 text-slate-400" />;
  };

  if (currentStreak === 0) return null;

  return (
    <Card className="bg-gradient-to-r from-orange-500/10 to-red-500/10 backdrop-blur-sm border-orange-500/30 shadow-2xl hover:shadow-orange-500/20 transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStreakIcon(currentStreak)}
            <div>
              <div className="text-sm text-slate-400">Profit Streak</div>
              <div className={`text-2xl font-bold ${getStreakColor(currentStreak)}`}>
                {currentStreak} rounds
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Best: {bestStreak}</div>
            {streakBonus > 0 && (
              <div className="text-sm text-green-400 font-semibold">
                +{streakBonus}% bonus
              </div>
            )}
          </div>
        </div>

        {/* Streak Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Next milestone</span>
            <span>{currentStreak}/5</span>
          </div>
          <div className="w-full bg-slate-600 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((currentStreak / 5) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Motivational Messages */}
        {currentStreak >= 3 && (
          <div className="mt-3 text-center">
            <div className="text-sm text-orange-400 font-semibold animate-pulse">
              {currentStreak >= 5 ? "🔥 ON FIRE! 🔥" :
               currentStreak >= 3 ? "🌟 Hot Streak! 🌟" :
               "📈 Building Momentum! 📈"}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
