import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Target, ShoppingCart, TrendingUp, Lightbulb } from "lucide-react";

interface TutorialProps {
  onStart: () => void;
}

export default function Tutorial({ onStart }: TutorialProps) {
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
            Touristic Procurement & Demand Simulation
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
                As tour operator teams, you purchase different fare classes from the airline and set end-customer prices.
                Customer demand is simulated based on their Willingness to Pay (WTP).
                <span className="text-green-400 font-semibold"> Goal: Achieve the highest profit (revenue - procurement costs)!</span>
              </p>
            </div>

            <div className="p-6 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl border border-purple-500/30">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <ShoppingCart className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Procurement Products</h3>
              </div>
              <div className="space-y-3 text-slate-300">
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="font-semibold text-green-400">Fix (€60/seat)</div>
                  <div className="text-sm">Cheapest option, but must be paid regardless of demand. Lowest risk for airline, highest risk for tour operator.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="font-semibold text-yellow-400">ProRata (€85/seat)</div>
                  <div className="text-sm">More expensive, but can be returned until 60 days before departure if not booked. Medium risk for both parties.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="font-semibold text-red-400">Pooling (€110/seat)</div>
                  <div className="text-sm">Highest price, daily price and availability updates, not guaranteed, only paid if actual demand exists.</div>
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
                <li>Select your procurement quantities per fare class</li>
                <li>Set end-customer prices</li>
                <li>Start the round – simulation calculates sales and profit</li>
                <li>Random factors influence demand</li>
                <li>Play multiple rounds and compare results</li>
              </ol>
              <div className="space-y-3">
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">💡 <strong>Pro Tip:</strong> Balance risk and reward</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">📊 <strong>Strategy:</strong> Watch demand patterns</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">🎯 <strong>Goal:</strong> Maximize profit margins</div>
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
                <div className="text-red-400 font-semibold mb-2">⚠️ Price too high</div>
                <div className="text-sm text-slate-300">Low sales volume</div>
              </div>
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-orange-400 font-semibold mb-2">⚠️ Price too low</div>
                <div className="text-sm text-slate-300">Wasted profit margins</div>
              </div>
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-green-400 font-semibold mb-2">✅ Optimal pricing</div>
                <div className="text-sm text-slate-300">Balance volume & margins</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-700/20 rounded-lg border border-slate-600/30">
              <div className="text-sm text-slate-400">
                <strong>Advanced:</strong> Use the seed for reproducible simulations to test different strategies
              </div>
            </div>
          </div>

          <div className="text-center pt-6">
            <Button
              onClick={onStart}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-lg px-8 py-4 rounded-xl shadow-lg transition-all duration-200 min-h-[56px]"
            >
              <span className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Start Simulation
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
