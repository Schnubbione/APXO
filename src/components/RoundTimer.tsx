import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface RoundTimerProps {
  roundTime: number; // in minutes
  isActive: boolean;
  onTimeUp: () => void;
}

export default function RoundTimer({ roundTime, isActive, onTimeUp }: RoundTimerProps) {
  const [timeLeft, setTimeLeft] = useState(roundTime * 60); // in seconds

  useEffect(() => {
    setTimeLeft(roundTime * 60);
  }, [roundTime]);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const isWarning = timeLeft <= 60; // Last minute red

  return (
    <Card className="fixed top-4 left-4 z-40 w-auto bg-slate-800/95 backdrop-blur-sm border-slate-600 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
      <CardContent className="p-4 sm:p-6">
        <div className="text-center">
          <div className="text-sm text-slate-400 mb-2 font-medium">Time Remaining</div>
          <div className={`text-3xl sm:text-4xl font-bold tabular-nums ${
            isWarning ? 'text-red-400 animate-pulse' : 'text-white'
          }`}>
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </div>
          {!isActive && <div className="text-sm text-slate-500 mt-2 font-medium">Round paused</div>}
        </div>
      </CardContent>
    </Card>
  );
}
