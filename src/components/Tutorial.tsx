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
  const bedCost = typeof gameState.hotelBedCost === 'number' ? gameState.hotelBedCost : 50;
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
                  <div className="font-semibold text-green-400">Phase 1: Fixplatz-Auktion</div>
                  <div className="text-sm">Gib <strong>ein maximales Gebot pro Sitz</strong> und <strong>deine Wunschmenge</strong> ab. Die Airline vergibt Fixplätze absteigend (Pay-as-Bid), bis die Kapazität erschöpft ist. Konkurrenzgebote und Restverfügbarkeit bleiben verborgen – dein Forecast entscheidet. Direkt danach erhält jedes Team identisches Hotelkontingent; jedes leere Bett kostet €{bedCost}.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="font-semibold text-blue-400">Phase 2: Live-Markt ({tickCount} Ticks)</div>
                  <div className="text-sm">Jeder Tick dauert ca. {secondsPerTick} Sekunden Echtzeit. Du setzt Retailpreis (Preisänderungen sind auf ±{priceGuardPct}% begrenzt), wählst einen Push-Level, kannst Fixplätze bewusst zurückhalten und optional ein Tool (<em>hedge</em>, <em>spotlight</em>, <em>commit</em>) aktivieren. Verkäufe ziehen zuerst aus Fixbeständen, danach – nur bei tatsächlichem Verkauf – aus Airline-Restkapazität zum aktuellen Poolingpreis (Start €{airlineStart}, Grenzen €{airlineMin}–€{airlineMax}).</div>
                  <div className="text-sm mt-2 text-indigo-300">💡 <strong>Realtime Control:</strong> Tools verursachen Kosten ({pushCosts.join(' / ')} €) und Cooldowns. Airline-Repricing reagiert nach jedem Tick auf Nachfrageabweichungen – halte deine Preise, Aufmerksamkeit und Fix-Hold stets im Blick.</div>
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
                <li><strong>Gebot platzieren.</strong> Menge &amp; Maximalpreis definieren, Auktionsende abwarten.</li>
                <li><strong>Allocation auswerten.</strong> Fixplätze, Durchschnittskosten und Hotelkontingent prüfen, erste Preisstrategie festlegen.</li>
                <li><strong>Ticker entscheiden.</strong> Pro Tick Preis, Push-Level, Fix-Hold-% und optionales Tool setzen – Pooling wird bei Bedarf automatisch eingekauft.</li>
                <li><strong>Briefing &amp; Debrief lesen.</strong> Airlinepreis, Restkapazität, Nachfrage und Profitranking analysieren.</li>
                <li><strong>Finalbericht nutzen.</strong> Sieg = höchster Profit <em>und</em> Ø-Verkaufspreis ≥ Ø-Einkaufspreis.</li>
              </ol>
              <div className="space-y-3">
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">💡 <strong>Pro Tip:</strong> Fixplätze lohnen nur, wenn du sie profitabel drehen kannst – sie kosten sofort mindestens €{fixPrice} plus Hotelrisiko.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">📊 <strong>Strategie:</strong> Push-Level erhöhen Aufmerksamkeit, aber auch Kosten; halte Budget für kritische Ticks bereit.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">🎯 <strong>Ziel:</strong> Preise taktisch anpassen ohne den Sprungwächter (±{priceGuardPct}%) zu brechen – stetige Moves schlagen hektische Reaktionen.</div>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                  <div className="text-sm text-slate-400">📈 <strong>Insights:</strong> Tick-Briefings zeigen Airlinepreis &amp; Ranking; Debriefs trennen Fix- und Poolingverkäufe, damit du Margen sofort siehst.</div>
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
                <strong>Advanced:</strong> Die Nachfrage folgt einer Logit-Funktion (α={agentConfig.market.alpha}, β={agentConfig.market.beta}) rund um den Referenzpreis €{agentConfig.market.P_ref}. Airline-Repricing nutzt Forecast vs. Verkäufe (`γ={agentConfig.airline.gamma}`, `κ={agentConfig.airline.kappa}`) – behalte deine kumulierten Verkäufe im Blick.
                Poolingkäufe kosten sofort den aktuellen Airlinepreis; Hotel-Leerbetten schlagen mit €{bedCost} pro Bett zu Buche. Verkäufe über das Hotelkontingent hinaus bleiben erlaubt (nur Sitzkosten fallen an).
                <span className="text-indigo-300">Plane Tools und Push-Level voraus: Kosten, Cooldowns und Aufmerksamkeit entscheiden über deine Marktanteile.</span>
                <span className="text-orange-400 font-semibold"> Phase 1 bleibt intransparenter Wettbewerb – sichere Forecasts und Risikoszenarien sind entscheidend!</span>
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
