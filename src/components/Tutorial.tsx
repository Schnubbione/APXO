// React import not required with the automatic JSX runtime
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Target, ShoppingCart, TrendingUp, Lightbulb } from "lucide-react";
import { useGame } from "@/contexts/GameContext";
import { defaultConfig } from "@/lib/simulation/defaultConfig";

interface TutorialProps {
  onStart: () => void;
  onStartTour?: () => void;
}

export default function Tutorial({ onStart, onStartTour }: TutorialProps) {
  const { gameState } = useGame();
  const fixPrice = typeof gameState.fixSeatPrice === 'number' ? gameState.fixSeatPrice : 60;
  const agentConfig = defaultConfig;
  const tickCount = agentConfig.ticks_total;
  const secondsPerTick = agentConfig.seconds_per_tick;
  const priceGuardPct = Math.round(agentConfig.rules.price_jump_threshold * 100);
  const pushCosts = agentConfig.rules.push_cost_per_level;
  const airlineStart = agentConfig.airline.P_airline_start;
  const airlineMin = agentConfig.airline.P_min;
  const airlineMax = agentConfig.airline.P_max;
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
                  <div className="font-semibold text-green-400">Phase 1: Fixed-Seat Auction (Pay-as-Bid)</div>
                  <div className="text-sm">Submit a sealed bid with a <strong>maximum price per seat</strong> and a <strong>desired quantity</strong>. The airline fills demand from the highest bids downward, subject to each team&apos;s optional budget cap. Competing bids and remaining capacity stay hidden, so forecasting risk matters.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="font-semibold text-blue-400">Phase 2: Live Market (countdown to departure)</div>
                  <div className="text-sm">A real-time countdown runs to departure (roughly {tickCount} updates at ~{secondsPerTick}s cadence). Adjust your retail price (large moves are capped at ±{priceGuardPct}%), optionally change push level, hold back a share of fixed seats, and trigger tools (<em>hedge</em>, <em>spotlight</em>, <em>commit</em>) to influence attention. Sales always consume fixed inventory first; only when that is gone does the airline provide just-in-time seats at the current pooling price (start €{airlineStart}, bounded by €{airlineMin}–€{airlineMax}).</div>
                  <div className="text-sm mt-2 text-indigo-300">💡 <strong>Dynamic control:</strong> Push levels cost {pushCosts.join(' / ')} € and tools come with cooldowns, so pace your budget. Airline repricing adjusts continuously based on the gap between forecast and actual sales.</div>
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
                <li><strong>Enter your sealed bid.</strong> Choose quantity and maximum seat price, then wait for the auction to clear.</li>
                <li><strong>Review the allocation.</strong> Note awarded seats and average cost before picking an opening price.</li>
                <li><strong>Steer the countdown.</strong> As the timer runs, adjust price, optional push level, fixed-seat hold %, and tools; pooling seats are purchased automatically only when a sale occurs.</li>
                <li><strong>Read the live briefings.</strong> Snapshots highlight airline price, remaining capacity, demand hints, and standings; debriefs break down fixed versus pooling sales and margins.</li>
                <li><strong>Inspect the final report.</strong> Victory demands the highest profit <em>and</em> an average sell price that meets or beats your average buy price.</li>
              </ol>
              <div className="space-y-3">
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-sm text-slate-400">💡 <strong>Pro tip:</strong> Fixed seats only pay off when you can resell them profitably – they cost at least €{fixPrice} up front and tie up capital.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">📊 <strong>Strategy:</strong> Push levels boost attention but reduce budget headroom; reserve cash for the key countdown windows and tool activations.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">🏦 <strong>Budget & solvency:</strong> During live play the legacy backend flags insolvency if cumulative profit drops beyond the team budget – monitor your margin so you stay in the game.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">📈 <strong>Insights:</strong> Live briefings share airline price and ranking trends; debriefs surface margins instantly for fixed versus pooling sales.</div>
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
                <div className="text-sm text-slate-300">High fixed costs if demand is low; keep an eye on the mix between fixed seats and pooling exposure</div>
              </div>
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-green-400 font-semibold mb-2">✅ Optimal balance</div>
                <div className="text-sm text-slate-300">Mix fixed & flexible capacity with market intelligence</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-700/20 rounded-lg border border-slate-600/30">
              <div className="text-sm text-slate-400">
                <strong>Advanced:</strong> Demand follows a logit curve (α={agentConfig.market.alpha}, β={agentConfig.market.beta}) centred on the reference price €{agentConfig.market.P_ref}. Airline repricing applies forecast feedback (`γ={agentConfig.airline.gamma}`, `κ={agentConfig.airline.kappa}`), so track cumulative sales against the booking curve.
                Pooling purchases are charged immediately at the current airline price. Selling beyond the fixed allotment remains profitable when your retail price stays above pooling costs.
                <span className="text-indigo-300">Plan push levels and tools ahead of time – their costs, cooldowns, and attention boosts determine how visible you are at each update of the countdown.</span>
                <span className="text-orange-400 font-semibold"> Phase 1 is a blind auction: solid forecasts and risk buffers are the difference between victory and overcommitting.</span>
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
