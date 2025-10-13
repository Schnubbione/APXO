import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Star, Target, AlertTriangle } from 'lucide-react';

interface MotivationalMessagesProps {
  currentTeam: any;
  roundResults: any[];
  leaderboard: any[];
}

export default function MotivationalMessages({ currentTeam, roundResults, leaderboard }: MotivationalMessagesProps) {
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'positive' | 'warning' | 'encouraging'>('encouraging');

  useEffect(() => {
    if (!currentTeam || !roundResults.length) return;

    const teamResults = roundResults.filter(r => r.teamId === currentTeam.id);
    const latestResult = teamResults[teamResults.length - 1];
    const previousResult = teamResults[teamResults.length - 2];

    if (!latestResult) return;

    // Calculate performance metrics
    const currentProfit = latestResult.profit;
    const previousProfit = previousResult?.profit || 0;
    const profitChange = currentProfit - previousProfit;

    const teamRank = leaderboard.findIndex(team => team.name === currentTeam.name) + 1;
    const totalTeams = leaderboard.length;

    // Determine message based on performance
    let message = '';
    let type: 'positive' | 'warning' | 'encouraging' = 'encouraging';

    if (currentProfit > 0) {
      // Profitable round
      if (profitChange > 0) {
        message = getRandomMessage([
          "🚀 Excellent! You're improving with every round!",
          "💪 Great job! Your strategy is paying off!",
          "🎯 Spot on! Keep up the momentum!",
          "🌟 Brilliant decision making!",
          "📈 You're on fire! Profits are climbing!"
        ]);
        type = 'positive';
      } else if (profitChange < 0) {
        message = getRandomMessage([
          "📊 Good profit, but there's room for improvement!",
          "🎪 Solid performance! Try optimizing your pricing next round.",
          "⚡ You're doing well, but watch your capacity allocation!",
          "🔍 Analyze your decisions - you can do even better!",
          "💡 Good foundation! Fine-tune for maximum profit."
        ]);
        type = 'encouraging';
      } else {
        message = getRandomMessage([
          "🎭 Consistent performance! Keep it up!",
          "⚖️ Steady profits - reliable strategy!",
          "🎪 Balanced approach working well!",
          "📊 Solid and predictable - that's good business!"
        ]);
        type = 'positive';
      }

      // Add rank-based motivation
      if (teamRank === 1) {
        message += " 🏆 You're leading the pack!";
      } else if (teamRank <= 3) {
        message += " 🥈 Top 3! You're in the running!";
      } else if (teamRank <= totalTeams / 2) {
        message += " 📊 You're in the top half - keep pushing!";
      }

    } else {
      // Loss round
      if (Math.abs(currentProfit) < 100) {
        message = getRandomMessage([
          "😅 Close call! Small loss - easy to turn around.",
          "🎪 Almost there! Minor adjustments needed.",
          "🔄 Learning experience! What can you improve?",
          "💭 Think about your pricing strategy.",
          "📈 Small setback - big comeback coming!"
        ]);
        type = 'warning';
      } else {
        message = getRandomMessage([
          "💪 Don't give up! Every expert was once a beginner.",
          "🔄 Reset and refocus - you can turn this around!",
          "🎯 Analyze what went wrong and adjust your strategy.",
          "🌱 Learning from losses builds stronger strategies!",
          "🚀 This is just a stepping stone to success!"
        ]);
        type = 'warning';
      }
    }

    // Special messages for milestones
    if (teamResults.filter(r => r.profit > 0).length >= 3) {
      message = "🔥 Hot streak! You're building momentum!";
      type = 'positive';
    }

    if (currentProfit > 500) {
      message = "💰 Outstanding! That's some serious profit!";
      type = 'positive';
    }

    setCurrentMessage(message);
    setMessageType(type);
  }, [roundResults, leaderboard, currentTeam]);

  const getRandomMessage = (messages: string[]) => {
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getMessageIcon = () => {
    switch (messageType) {
      case 'positive':
        return <Star className="w-5 h-5 text-yellow-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-orange-400" />;
      case 'encouraging':
        return <Heart className="w-5 h-5 text-blue-400" />;
      default:
        return <Target className="w-5 h-5 text-slate-400" />;
    }
  };

  const getMessageColor = () => {
    switch (messageType) {
      case 'positive':
        return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      case 'warning':
        return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
      case 'encouraging':
        return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      default:
        return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
    }
  };

  if (!currentMessage) return null;

  return (
    <Card className={`backdrop-blur-sm shadow-2xl hover:shadow-slate-900/20 transition-all duration-300 border ${getMessageColor()}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {getMessageIcon()}
          <div className="flex-1">
            <div className="text-sm font-medium">
              {currentMessage}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
