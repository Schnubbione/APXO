import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Zap, Flame, Target } from "lucide-react";

interface RoundTimerProps {
  roundTime: number; // in minutes
  isActive: boolean;
  onTimeUp: () => void;
}

export default function RoundTimer({ roundTime, isActive, onTimeUp }: RoundTimerProps) {
  const [timeLeft, setTimeLeft] = useState(roundTime * 60); // in seconds
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    setTimeLeft(roundTime * 60);
    setProgress(100);
  }, [roundTime]);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        const newTime = prev - 1;
        setProgress((newTime / (roundTime * 60)) * 100);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, onTimeUp, roundTime]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const isWarning = timeLeft <= 60; // Last minute red
  const isUrgent = timeLeft <= 30; // Last 30 seconds critical
  const isHalfway = timeLeft <= (roundTime * 60) / 2; // Past halfway point

  const getTimerColor = () => {
    if (isUrgent) return 'text-red-400 animate-pulse';
    if (isWarning) return 'text-orange-400';
    if (isHalfway) return 'text-yellow-400';
    return 'text-white';
  };

  const getProgressColor = () => {
    if (isUrgent) return 'from-red-500 to-red-600';
    if (isWarning) return 'from-orange-500 to-orange-600';
    if (isHalfway) return 'from-yellow-500 to-yellow-600';
    return 'from-green-500 to-green-600';
  };

  const getMotivationalIcon = () => {
    if (isUrgent) return <Flame className="w-5 h-5 text-red-400 animate-pulse" />;
    if (isWarning) return <Zap className="w-5 h-5 text-orange-400 animate-bounce" />;
    if (isHalfway) return <Target className="w-5 h-5 text-yellow-400" />;
    return <Clock className="w-5 h-5 text-green-400" />;
  };

  const getMotivationalMessage = () => {
    if (isUrgent) return "⚡ Time's almost up! Final decisions!";
    if (isWarning) return "🚨 Last minute! Lock in your strategy!";
    if (isHalfway) return "🎯 Halfway there! Review your choices.";
    return "⏰ Round in progress. Make your moves!";
  };

  return (
    <Card className="fixed top-4 left-4 z-40 w-auto bg-slate-800/95 backdrop-blur-sm border-slate-600 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
      <CardContent className="p-4 sm:p-6">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            {getMotivationalIcon()}
            <div className="text-sm text-slate-400 font-medium">Time Remaining</div>
          </div>

          <div className={`text-3xl sm:text-4xl font-bold tabular-nums ${getTimerColor()}`}>
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 bg-gradient-to-r ${getProgressColor()} transition-all duration-1000 ease-out rounded-full`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Motivational Message */}
          <div className={`text-xs font-medium ${getTimerColor()}`}>
            {getMotivationalMessage()}
          </div>

          {!isActive && (
            <div className="text-sm text-slate-500 mt-2 font-medium">
              Round paused
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
