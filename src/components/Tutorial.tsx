import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Target, Gavel, Timer, TrendingUp } from "lucide-react";
import { useGame } from "@/contexts/GameContext";

interface TutorialProps {
  onStart: () => void;
  onStartTour?: () => void;
}

export default function Tutorial({ onStart, onStartTour }: TutorialProps) {
  const { gameState } = useGame();

  const fixSeatPrice = typeof gameState.fixSeatPrice === "number" ? gameState.fixSeatPrice : 60;
  const totalSeats = typeof gameState.totalAircraftSeats === "number" ? gameState.totalAircraftSeats : 1000;
  const poolingPrice = typeof gameState.poolingMarket?.currentPrice === "number"
    ? gameState.poolingMarket.currentPrice
    : 150;
  const biddingMinutes = Math.max(1, Math.round((gameState.roundTime || 180) / 60));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-3xl w-full bg-slate-800/90 backdrop-blur-sm border-slate-700 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <MapPin className="w-10 h-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-white mb-2">
            Multiplayer Simulation Overview
          </CardTitle>
          <p className="text-slate-400 text-base max-w-2xl mx-auto">
            Every round has two simple steps: secure seats in the bidding phase, then steer demand during the live simulation. Profit decides the leaderboard.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-6 bg-slate-700/40 rounded-xl border border-slate-600/60">
            <div className="flex items-start gap-3">
              <Target className="w-6 h-6 text-emerald-300 mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-white">Goal</h3>
                <p className="text-slate-300 mt-2">
                  Build the most profitable tour operation. Fixed seats you win sell first at your retail price. When you run out, extra demand buys pooling seats directly from the airline at the live market price, so staying above the pooling cost keeps you in the black.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-gradient-to-br from-indigo-500/15 to-indigo-600/15 rounded-xl border border-indigo-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Gavel className="w-6 h-6 text-indigo-300" />
                </div>
                <h3 className="text-lg font-semibold text-white">Phase 1 – Bidding</h3>
              </div>
              <ul className="space-y-2 text-sm text-slate-200">
                <li>• Submit a sealed bid with your maximum price per seat (current target: €{fixSeatPrice}).</li>
                <li>• Choose how many of the {totalSeats.toLocaleString("de-DE")} seats you want to lock in.</li>
                <li>• The airline accepts the highest bids first until capacity runs out—you only learn your allocation when the timer ends.</li>
              </ul>
              <p className="text-xs text-slate-400 mt-3">
                Bidding runs for about {biddingMinutes} minute{biddingMinutes === 1 ? "" : "s"}. Plan a mix of inventory and budget so you have room to react later.
              </p>
            </div>

            <div className="p-5 bg-gradient-to-br from-amber-500/15 to-amber-600/15 rounded-xl border border-amber-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Timer className="w-6 h-6 text-amber-300" />
                </div>
                <h3 className="text-lg font-semibold text-white">Phase 2 – Simulation</h3>
              </div>
              <ul className="space-y-2 text-sm text-slate-200">
                <li>• One in-game year counts down in real time (≈365 seconds, one day per second).</li>
                <li>• Adjust your retail price at any moment—new settings apply to the next demand tick.</li>
                <li>• Demand consumes fixed seats first; when those are gone, pooling seats are bought automatically at the live airline price (currently €{poolingPrice}).</li>
              </ul>
              <p className="text-xs text-slate-400 mt-3">
                Keep your retail price comfortably above pooling to avoid negative margins as you scale.
              </p>
            </div>
          </div>

          <div className="p-5 bg-slate-700/30 rounded-xl border border-slate-600/50">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-6 h-6 text-sky-300 mt-1" />
              <div className="space-y-2 text-sm text-slate-200">
                <h3 className="text-lg font-semibold text-white">Round cadence</h3>
                <ul className="space-y-2">
                  <li>• Admin opens bidding, the timer runs, and allocations are revealed.</li>
                  <li>• Simulation begins instantly—watch the countdown and tweak pricing as often as needed.</li>
                  <li>• At departure (day 0) the scoreboard freezes, profit rankings update, and the evaluation screen summarises the round.</li>
                </ul>
                <p className="text-xs text-slate-400">
                  Profit—not revenue—determines the leaderboard. Selling pooling seats below cost will drop you in the standings fast.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center pt-2">
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button
                onClick={onStart}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-8 py-3 rounded-xl shadow-lg transition-all duration-200 min-h-[52px] w-full sm:w-auto"
              >
                <span className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Enter Lobby
                </span>
              </Button>
              {onStartTour && (
                <Button
                  onClick={onStartTour}
                  variant="outline"
                  className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700/70 font-semibold px-8 py-3 rounded-xl transition-all duration-200 min-h-[52px] w-full sm:w-auto"
                >
                  Start Guided Tour
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
