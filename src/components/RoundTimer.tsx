import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Zap, Flame, Target, ChevronDown, ChevronUp } from "lucide-react";

interface RoundTimerProps {
  roundTime: number; // in minutes
  isActive: boolean;
  onTimeUp: () => void;
  currentPhase?: 'prePurchase' | 'simulation' | 'setup';
  remainingTime?: number; // in seconds, from server
  simulatedDaysUntilDeparture?: number; // from server during simulation
}

export default function RoundTimer({ roundTime, isActive, onTimeUp, currentPhase, remainingTime, simulatedDaysUntilDeparture }: RoundTimerProps) {
  const [timeLeft, setTimeLeft] = useState(remainingTime || roundTime * 60); // in seconds
  const [progress, setProgress] = useState(100);
  const [isCompact, setIsCompact] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompact(event.matches);
    };

    setIsCompact(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    setIsCollapsed(isCompact);
  }, [isCompact]);

  // Update time when remainingTime from server changes
  useEffect(() => {
    if (remainingTime !== undefined) {
      setTimeLeft(remainingTime);
      setProgress((remainingTime / (roundTime * 60)) * 100);
    }
  }, [remainingTime, roundTime]);

  // Reset when roundTime changes (e.g., new phase/round)
  useEffect(() => {
    if (remainingTime === undefined) {
      setTimeLeft(roundTime * 60);
      setProgress(100);
    }
  }, [roundTime, remainingTime]);

  // Only run local timer if no server time is available (fallback)
  useEffect(() => {
    if (!isActive || remainingTime !== undefined) return;
    // Never run timer in simulation phase (it's hidden there)
    if (currentPhase === 'simulation') return;

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
  }, [isActive, onTimeUp, roundTime, remainingTime]);

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

    // Phase-specific messages
    if (currentPhase === 'prePurchase') {
      return "⏰ Pre-purchase phase active. Buy fix seats!";
    }
    if (currentPhase === 'simulation') {
      return "🚀 Simulation running. Monitor your bookings!";
    }

    return "⏰ Phase in progress. Make your moves!";
  };

  // Hide timer before a round actually starts for non-simulation phases
  if (!isActive && (currentPhase === 'prePurchase' || currentPhase === 'setup' || !currentPhase)) {
    return null;
  }

  const isSimulationPhase = currentPhase === 'simulation';
  const daysUntilDeparture = isSimulationPhase
    ? Math.max(0, Math.floor(Number(simulatedDaysUntilDeparture ?? 0)))
    : null;

  const primaryValue = isSimulationPhase
    ? `${daysUntilDeparture} day${daysUntilDeparture === 1 ? "" : "s"}`
    : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const subtitle = isSimulationPhase ? "Days until departure" : "Time Remaining";
  const primaryClasses = isSimulationPhase
    ? "text-3xl sm:text-4xl font-bold text-white"
    : `text-3xl sm:text-4xl font-bold tabular-nums ${getTimerColor()}`;
  const subtitleClasses = isSimulationPhase
    ? "text-sm text-slate-300 font-medium"
    : "text-sm text-slate-400 font-medium";
  const messageText = isSimulationPhase
    ? "Simulation running. Customers book in intervals."
    : getMotivationalMessage();
  const messageClasses = isSimulationPhase
    ? "text-xs font-medium text-slate-300"
    : `text-xs font-medium ${getTimerColor()}`;
  const leadingIcon = isSimulationPhase
    ? <Clock className="w-5 h-5 text-blue-400" />
    : getMotivationalIcon();

  if (isCompact && isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setIsCollapsed(false)}
        className="fixed bottom-4 left-1/2 z-40 flex items-center gap-2 -translate-x-1/2 transform rounded-full border border-slate-600 bg-slate-900/90 px-4 py-2 text-sm font-medium text-slate-200 shadow-lg backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 focus:ring-offset-slate-900"
        aria-label="Timer öffnen"
      >
        <Clock className="w-4 h-4 text-slate-300" />
        <span className="font-mono text-base text-white">
          {isSimulationPhase ? `${daysUntilDeparture}d` : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`}
        </span>
        <ChevronUp className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  const cardPositionClasses = isCompact
    ? "bottom-4 left-1/2 -translate-x-1/2 transform w-[calc(100%-2rem)] max-w-md"
    : "top-4 left-4 w-auto";
  const contentPadding = isCompact ? "p-3" : "p-4 sm:p-6";
  const stackSpacing = isCompact ? "space-y-2" : "space-y-3";

  return (
    <Card className={`fixed z-40 bg-slate-800/95 backdrop-blur-sm border-slate-600 shadow-2xl hover:shadow-slate-900/20 transition-all duration-300 ${cardPositionClasses}`}>
      <CardContent className={`relative ${contentPadding}`}>
        {isCompact && (
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="absolute right-2 top-2 rounded-full p-1 text-slate-400 transition hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Timer minimieren"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
        <div className={`text-center ${stackSpacing}`}>
          <div className="flex items-center justify-center gap-2">
            {leadingIcon}
            <div className={subtitleClasses}>{subtitle}</div>
          </div>

          <div className={primaryClasses}>
            {primaryValue}
          </div>

          {!isSimulationPhase && (
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 bg-gradient-to-r ${getProgressColor()} transition-all duration-1000 ease-out rounded-full`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <div className={messageClasses}>
            {messageText}
          </div>

          {isSimulationPhase && !isActive && (
            <div className="text-sm text-slate-500 mt-1 font-medium">
              Simulation pausiert
            </div>
          )}
          {!isSimulationPhase && !isActive && (
            <div className="text-sm text-slate-500 mt-1 font-medium">
              Round paused
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
