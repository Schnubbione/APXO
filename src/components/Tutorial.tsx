// React import not required with the automatic JSX runtime
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Target, ShoppingCart, TrendingUp, Lightbulb } from "lucide-react";
import { useGame } from "@/contexts/GameContext";

interface TutorialProps {
  onStart: () => void;
  onStartTour?: () => void;
}

export default function Tutorial({ onStart, onStartTour }: TutorialProps) {
  const { gameState } = useGame();
  const fixPrice = typeof gameState.fixSeatPrice === 'number' ? gameState.fixSeatPrice : 60;
  const bedCost = typeof gameState.hotelBedCost === 'number' ? gameState.hotelBedCost : 50;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full bg-slate-800/90 backdrop-blur-sm border-slate-700 shadow-2xl">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <MapPin className="w-10 h-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-white mb-2">
            Allotment Procurement & Demand Simulation
          </CardTitle>
          <p className="text-slate-400 text-lg">Master the art of touristic procurement and demand management</p>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl border border-blue-500/30">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Target className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Game Objective</h3>
              </div>
              <p className="text-slate-300 leading-relaxed">
                As tour operator teams, you compete in a two-phase game to maximize profits through strategic procurement and pricing decisions.
                <span className="text-green-400 font-semibold"> Goal: Achieve the highest profit by balancing procurement costs and customer demand!</span>
              </p>
            </div>

            <div className="p-6 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl border border-purple-500/30">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <ShoppingCart className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Two-Phase System</h3>
              </div>
        <div className="space-y-3 text-slate-300">
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="font-semibold text-green-400">Phase 1: Seat Auction</div>
                  <div className="text-sm">Submit <strong>a bid per seat</strong> and <strong>a desired quantity</strong>. The airline allocates fixed seats starting with the highest bids until capacity is exhausted. Competing bids and remaining availability stay hidden, so you must weigh risk, budget and expected demand. Immediately after the auction, every team receives the same hotel capacity; empty beds later cost €{bedCost} each.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="font-semibold text-blue-400">Phase 2: Live Market Simulation (365 days)</div>
                  <div className="text-sm">Every second equals one simulated day. Travelers always start with the lowest customer price, moving up the ladder only if seats remain. You can top up supply through pooling; the pooling price reacts to supply/demand imbalances in real time.</div>
                  <div className="text-sm mt-2 text-indigo-300">💡 <strong>Real-time Control:</strong> Set an initial price before the simulation begins, then adjust while the market runs to protect margin or gain share.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 rounded-xl border border-indigo-500/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Game Flow</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ol className="list-decimal list-inside space-y-2 text-slate-300">
                <li><strong>Submit your auction bid.</strong> Pick the quantity and maximum price per seat. The allocation is revealed once the timer expires.</li>
                <li><strong>Prepare for launch.</strong> Review the seats you actually won, note your hotel capacity, and set an opening customer price.</li>
                <li><strong>Run the year-long simulation.</strong> Monitor live demand, adjust prices, and decide when buying pooling seats is worth it as the airline price reacts to utilization.</li>
                <li><strong>Review the results.</strong> After each round, inspect profit, market share, demand, and achievements to refine your strategy for the next auction.</li>
              </ol>
              <div className="space-y-3">
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">💡 <strong>Pro Tip:</strong> Bid aggressively only when you can monetize the seats. Overbidding creates expensive inventory and higher hotel risk.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">📊 <strong>Strategy:</strong> Balance committed seats with flexible pooling supply; the lowest retail price is not always the most profitable.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">🎯 <strong>Goal:</strong> React quickly to pooling price shocks and competitor pricing to stay ahead.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">📈 <strong>Market Intelligence:</strong> Use the live pooling ticker to gauge demand trends and anticipate shortages.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-xl border border-amber-500/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Lightbulb className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Strategic Tips</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-red-400 font-semibold mb-2">⚠️ Too few fixed seats</div>
                <div className="text-sm text-slate-300">Miss out on guaranteed capacity - high risk under information asymmetry</div>
              </div>
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-orange-400 font-semibold mb-2">⚠️ Too many fixed seats</div>
                <div className="text-sm text-slate-300">High fixed costs if demand is low; watch hotel empty-bed costs when capacity goes unused</div>
              </div>
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-green-400 font-semibold mb-2">✅ Optimal balance</div>
                <div className="text-sm text-slate-300">Mix fixed & flexible capacity with market intelligence</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-700/20 rounded-lg border border-slate-600/30">
              <div className="text-sm text-slate-400">
                <strong>Advanced:</strong> Demand responds to market prices and capacity. Monitor patterns over 365 days and adjust pricing dynamically.
                Use the live pooling market to anticipate trends; pooling usage costs apply at the current market price. Hotel empty beds incur a cost; selling beyond hotel capacity is allowed and remains profitable (minus seat costs).
                <span className="text-indigo-300">Set your initial price before the simulation starts, then use the "Update Price" button during the simulation.</span>
                <span className="text-orange-400 font-semibold"> Remember: Information asymmetry in Phase 1 requires strategic risk assessment!</span>
              </div>
            </div>
          </div>

          <div className="text-center pt-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                onClick={onStart}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-lg px-8 py-4 rounded-xl shadow-lg transition-all duration-200 min-h-[56px] w-full sm:w-auto"
              >
                <span className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Start Simulation
                </span>
              </Button>
              {onStartTour && (
                <Button
                  onClick={onStartTour}
                  variant="outline"
                  className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700/70 font-semibold text-lg px-8 py-4 rounded-xl transition-all duration-200 min-h-[56px] w-full sm:w-auto"
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
