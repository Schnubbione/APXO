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
                  <div className="font-semibold text-green-400">Phase 1: Pre-Purchase (Limited Time)</div>
                  <div className="text-sm">Purchase fixed seats at €60 each. Only 500 seats available total - first come, first served! These seats are guaranteed but must be paid regardless of demand.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="font-semibold text-blue-400">Phase 2: Simulation (365 Days)</div>
                  <div className="text-sm">Set customer prices and allocate pooling capacity. Customer demand increases as departure approaches. Compete with other teams for market share!</div>
                  <div className="text-sm mt-2 text-indigo-300">💡 <strong>Real-time Market:</strong> Prices update every second, simulating one day of market activity. Set your initial price before the simulation starts!</div>
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
                <li><strong>Phase 1:</strong> Purchase fixed seats (€60 each, limited to 500 total)</li>
                <li><strong>Phase 2:</strong> Set customer prices and pooling allocation</li>
                <li>Simulation runs for 365 days with increasing demand</li>
                <li>Monitor live pooling market data (updates every second = 1 simulated day)</li>
                <li>Monthly results show sales, revenue, and profits</li>
                <li>Compare final results across all teams</li>
              </ol>
              <div className="space-y-3">
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">💡 <strong>Pro Tip:</strong> Buy early in Phase 1 - seats are limited!</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">📊 <strong>Strategy:</strong> Balance fixed costs with flexible capacity</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">🎯 <strong>Goal:</strong> Optimize pricing as departure nears</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">📈 <strong>Market Intelligence:</strong> Use pooling market data to predict demand trends</div>
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
                <div className="text-sm text-slate-300">Miss out on guaranteed capacity</div>
              </div>
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-orange-400 font-semibold mb-2">⚠️ Too many fixed seats</div>
                <div className="text-sm text-slate-300">High fixed costs if demand is low</div>
              </div>
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-green-400 font-semibold mb-2">✅ Optimal balance</div>
                <div className="text-sm text-slate-300">Mix fixed & flexible capacity</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-700/20 rounded-lg border border-slate-600/30">
              <div className="text-sm text-slate-400">
                <strong>Advanced:</strong> Monitor demand patterns over 365 days and adjust pricing dynamically to maximize profits.
                Use the live pooling market data to anticipate market trends and make strategic pricing decisions.
                <span className="text-indigo-300">Set your initial price before the simulation starts, then use the "Update Price" button during the simulation.</span>
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
