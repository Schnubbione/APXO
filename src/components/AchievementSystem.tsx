import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, TrendingUp, Award, Star, Zap, Crown, Flame } from 'lucide-react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface AchievementSystemProps {
  currentTeam: any;
  roundResults: any[];
  leaderboard: any[];
  onPlaySound?: (sound: 'achievement' | 'roundStart' | 'roundEnd' | 'warning' | 'success' | 'error') => void;
}

const ACHIEVEMENT_TYPES = {
  FIRST_PROFIT: 'first_profit',
  PROFIT_STREAK: 'profit_streak',
  HIGH_PROFIT: 'high_profit',
  MARKET_LEADER: 'market_leader',
  PERFECT_ROUND: 'perfect_round',
  CONSISTENT_PERFORMER: 'consistent_performer',
  PRICE_OPTIMIZER: 'price_optimizer',
  CAPACITY_MASTER: 'capacity_master'
};

export default function AchievementSystem({ currentTeam, roundResults, leaderboard, onPlaySound }: AchievementSystemProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showNewAchievement, setShowNewAchievement] = useState<string | null>(null);

  // Initialize achievements
  useEffect(() => {
    const initialAchievements: Achievement[] = [
      {
        id: ACHIEVEMENT_TYPES.FIRST_PROFIT,
        title: 'First Profit',
        description: 'Earn your first profit in any round',
        icon: <Trophy className="w-5 h-5" />,
        unlocked: false,
        rarity: 'common'
      },
      {
        id: ACHIEVEMENT_TYPES.PROFIT_STREAK,
        title: 'Profit Streak',
        description: 'Earn profit in 3 consecutive rounds',
        icon: <Flame className="w-5 h-5" />,
        unlocked: false,
        progress: 0,
        maxProgress: 3,
        rarity: 'rare'
      },
      {
        id: ACHIEVEMENT_TYPES.HIGH_PROFIT,
        title: 'High Roller',
        description: 'Earn €500+ profit in a single round',
        icon: <Star className="w-5 h-5" />,
        unlocked: false,
        rarity: 'epic'
      },
      {
        id: ACHIEVEMENT_TYPES.MARKET_LEADER,
        title: 'Market Leader',
        description: 'Be #1 on the leaderboard',
        icon: <Crown className="w-5 h-5" />,
        unlocked: false,
        rarity: 'legendary'
      },
      {
        id: ACHIEVEMENT_TYPES.PERFECT_ROUND,
        title: 'Perfect Round',
        description: 'Sell 100% of your capacity',
        icon: <Target className="w-5 h-5" />,
        unlocked: false,
        rarity: 'epic'
      },
      {
        id: ACHIEVEMENT_TYPES.CONSISTENT_PERFORMER,
        title: 'Consistent Performer',
        description: 'Earn profit in 5 out of 6 rounds',
        icon: <TrendingUp className="w-5 h-5" />,
        unlocked: false,
        progress: 0,
        maxProgress: 5,
        rarity: 'rare'
      },
      {
        id: ACHIEVEMENT_TYPES.PRICE_OPTIMIZER,
        title: 'Price Optimizer',
        description: 'Set a price within optimal range (150-250€)',
        icon: <Award className="w-5 h-5" />,
        unlocked: false,
        rarity: 'common'
      },
      {
        id: ACHIEVEMENT_TYPES.CAPACITY_MASTER,
        title: 'Capacity Master',
        description: 'Book exactly the right amount of capacity',
        icon: <Zap className="w-5 h-5" />,
        unlocked: false,
        rarity: 'rare'
      }
    ];
    setAchievements(initialAchievements);
  }, []);

  // Check for achievements when round results change
  useEffect(() => {
    if (!currentTeam || !roundResults.length) return;

    const teamResults = roundResults.filter(r => r.teamId === currentTeam.id);
    const latestResult = teamResults[teamResults.length - 1];

    if (!latestResult) return;

    setAchievements(prev => {
      const updated = [...prev];
      let newUnlock = null;

      // Check First Profit
      if (!updated.find(a => a.id === ACHIEVEMENT_TYPES.FIRST_PROFIT)?.unlocked && latestResult.profit > 0) {
        const index = updated.findIndex(a => a.id === ACHIEVEMENT_TYPES.FIRST_PROFIT);
        updated[index].unlocked = true;
        newUnlock = ACHIEVEMENT_TYPES.FIRST_PROFIT;
      }

      // Check High Profit
      if (!updated.find(a => a.id === ACHIEVEMENT_TYPES.HIGH_PROFIT)?.unlocked && latestResult.profit >= 500) {
        const index = updated.findIndex(a => a.id === ACHIEVEMENT_TYPES.HIGH_PROFIT);
        updated[index].unlocked = true;
        newUnlock = ACHIEVEMENT_TYPES.HIGH_PROFIT;
      }

      // Check Perfect Round (100% capacity utilization)
      const totalCapacity = Object.values(currentTeam.decisions.buy).reduce((a: number, b: any) => a + Number(b), 0);
      if (!updated.find(a => a.id === ACHIEVEMENT_TYPES.PERFECT_ROUND)?.unlocked &&
          totalCapacity > 0 && latestResult.sold === totalCapacity) {
        const index = updated.findIndex(a => a.id === ACHIEVEMENT_TYPES.PERFECT_ROUND);
        updated[index].unlocked = true;
        newUnlock = ACHIEVEMENT_TYPES.PERFECT_ROUND;
      }

      // Check Price Optimizer
      if (!updated.find(a => a.id === ACHIEVEMENT_TYPES.PRICE_OPTIMIZER)?.unlocked &&
          currentTeam.decisions.price >= 150 && currentTeam.decisions.price <= 250) {
        const index = updated.findIndex(a => a.id === ACHIEVEMENT_TYPES.PRICE_OPTIMIZER);
        updated[index].unlocked = true;
        newUnlock = ACHIEVEMENT_TYPES.PRICE_OPTIMIZER;
      }

      // Update Profit Streak
      const streakAchievement = updated.find(a => a.id === ACHIEVEMENT_TYPES.PROFIT_STREAK);
      if (streakAchievement && !streakAchievement.unlocked) {
        const profitableRounds = teamResults.filter(r => r.profit > 0).length;
        streakAchievement.progress = Math.min(profitableRounds, 3);
        if (profitableRounds >= 3) {
          streakAchievement.unlocked = true;
          newUnlock = ACHIEVEMENT_TYPES.PROFIT_STREAK;
        }
      }

      // Update Consistent Performer
      const consistentAchievement = updated.find(a => a.id === ACHIEVEMENT_TYPES.CONSISTENT_PERFORMER);
      if (consistentAchievement && !consistentAchievement.unlocked) {
        const profitableRounds = teamResults.filter(r => r.profit > 0).length;
        consistentAchievement.progress = Math.min(profitableRounds, 5);
        if (profitableRounds >= 5) {
          consistentAchievement.unlocked = true;
          newUnlock = ACHIEVEMENT_TYPES.CONSISTENT_PERFORMER;
        }
      }

        if (newUnlock) {
          setShowNewAchievement(newUnlock);
          onPlaySound?.('achievement');
          setTimeout(() => setShowNewAchievement(null), 3000);
        }      return updated;
    });
  }, [roundResults, currentTeam]);

  // Check Market Leader
  useEffect(() => {
    if (!leaderboard.length || !currentTeam) return;

    const isLeader = leaderboard[0]?.name === currentTeam.name;
    if (isLeader) {
      setAchievements(prev => {
        const updated = [...prev];
        const index = updated.findIndex(a => a.id === ACHIEVEMENT_TYPES.MARKET_LEADER);
        if (!updated[index].unlocked) {
          updated[index].unlocked = true;
          setShowNewAchievement(ACHIEVEMENT_TYPES.MARKET_LEADER);
          onPlaySound?.('achievement');
          setTimeout(() => setShowNewAchievement(null), 3000);
        }
        return updated;
      });
    }
  }, [leaderboard, currentTeam]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500';
      case 'rare': return 'bg-blue-500';
      case 'epic': return 'bg-purple-500';
      case 'legendary': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  return (
    <>
      {/* Achievement Notification */}
      {showNewAchievement && (
        <div className="fixed top-20 right-4 z-50 animate-bounce">
          <Card className="bg-gradient-to-r from-yellow-500 to-orange-500 border-yellow-400 shadow-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-white" />
                <div>
                  <div className="text-white font-bold">Achievement Unlocked!</div>
                  <div className="text-yellow-100 text-sm">
                    {achievements.find(a => a.id === showNewAchievement)?.title}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Achievement Overview */}
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl text-white">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            Achievements ({unlockedCount}/{totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg border transition-all duration-200 ${
                  achievement.unlocked
                    ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50'
                    : 'bg-slate-700/30 border-slate-600/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    achievement.unlocked ? 'bg-yellow-500/30' : 'bg-slate-600/50'
                  }`}>
                    {achievement.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-semibold ${
                        achievement.unlocked ? 'text-yellow-400' : 'text-slate-400'
                      }`}>
                        {achievement.title}
                      </h4>
                      <Badge className={`text-xs ${getRarityColor(achievement.rarity)}`}>
                        {achievement.rarity}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{achievement.description}</p>
                    {achievement.progress !== undefined && achievement.maxProgress && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Progress</span>
                          <span>{achievement.progress}/{achievement.maxProgress}</span>
                        </div>
                        <div className="w-full bg-slate-600 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
