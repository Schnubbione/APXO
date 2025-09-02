import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Settings, Users, Plane, RefreshCcw, Play, Pause, LineChart, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import Tutorial from "./components/Tutorial";

// ----------------------------------------------
// Utility: seeded RNG (Mulberry32)
// ----------------------------------------------
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngWithSeed(seed: number) {
  const rand = mulberry32(seed >>> 0);
  return {
    next: () => rand(),
    nextInt: (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min,
    normal: (mean = 0, sd = 1) => {
      // Box–Muller
      let u = 0, v = 0;
      while (u === 0) u = rand();
      while (v === 0) v = rand();
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      return z * sd + mean;
    },
    lognormal: (mu = 0, sigma = 1) => Math.exp((() => {
      let u = 0, v = 0;
      while (u === 0) u = rand();
      while (v === 0) v = rand();
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      return z * sigma + mu;
    })()),
  };
}

// ----------------------------------------------
// Types
// ----------------------------------------------

type FareClass = {
  code: string;
  label: string;
  cost: number; // Einkaufspreis Reisebüro pro Sitz
};

type TeamDecision = {
  price: number; // Endkundenpreis
  buy: Record<string, number>; // code -> Menge
};

type RoundResult = {
  teamId: number;
  sold: number;
  revenue: number;
  cost: number;
  profit: number;
  unsold: number;
};

// ----------------------------------------------
// Default Config
// ----------------------------------------------
const DEFAULT_FARES: FareClass[] = [
  { code: "E", label: "Economy", cost: 50 },
  { code: "P", label: "Premium Economy", cost: 100 },
  { code: "B", label: "Business", cost: 200 },
  { code: "F", label: "First Class", cost: 400 },
];

const TEAM_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#9333ea", "#0891b2"]; // For Legend markers only

// ----------------------------------------------
// Demand generation
// ----------------------------------------------
function generateCustomers(
  rng: ReturnType<typeof rngWithSeed>,
  count: number,
  distribution: "normal" | "lognormal" | "uniform",
  center: number,
  spread: number,
  shock: number
) {
  const customers: number[] = [];
  for (let i = 0; i < count; i++) {
    let wtp = 0;
    if (distribution === "normal") wtp = Math.max(0, rng.normal(center, spread));
    else if (distribution === "lognormal") {
      // choose parameters so that median ~ center
      const mu = Math.log(Math.max(1, center));
      const sigma = Math.max(0.01, spread / Math.max(1, center));
      wtp = rng.lognormal(mu, sigma);
    } else {
      // uniform
      wtp = rng.next() * (center + spread) + Math.max(0, center - spread);
    }
    // Random shock (+/- shock%)
    const factor = 1 + (rng.next() * 2 - 1) * shock;
    customers.push(Math.max(0, wtp * factor));
  }
  return customers.sort((a, b) => b - a); // high WTP first
}

// ----------------------------------------------
// Main Component
// ----------------------------------------------
export default function App() {
  const [showTutorial, setShowTutorial] = useState(true);
  // Global config ("Leitstand")
  const [numTeams, setNumTeams] = useState(4);
  const [rounds, setRounds] = useState(6);
  const [currentRound, setCurrentRound] = useState(1);
  const [fares, setFares] = useState<FareClass[]>(DEFAULT_FARES);
  const [distribution, setDistribution] = useState<"normal" | "lognormal" | "uniform">("normal");
  const [baseDemand, setBaseDemand] = useState(80);
  const [spread, setSpread] = useState(40);
  const [shock, setShock] = useState(0.15); // +/-15%
  const [sharedMarket, setSharedMarket] = useState(true);
  const [seed, setSeed] = useState(42);
  const [autoRun, setAutoRun] = useState(false);

  // Teams state
  const emptyDecision = useMemo(() => ({ price: 199, buy: Object.fromEntries(fares.map(f => [f.code, 0])) }) as TeamDecision, [fares]);
  const [decisions, setDecisions] = useState<TeamDecision[]>(() => Array.from({ length: 6 }, () => ({...emptyDecision})));

  // Scoreboard
  const [history, setHistory] = useState<RoundResult[][]>([]); // per round -> list of team results

  // recompute if fares change -> extend buy map keys
  React.useEffect(() => {
    setDecisions(prev => prev.slice(0, numTeams).map(d => ({
      price: d.price ?? 199,
      buy: fares.reduce((acc, f) => ({ ...acc, [f.code]: d.buy?.[f.code] ?? 0 }), {} as Record<string, number>)
    })));
  }, [fares, numTeams]);

  // Auto-run handler
  React.useEffect(() => {
    if (!autoRun) return;
    if (currentRound > rounds) return;
    const t = setTimeout(() => handleRunRound(), 800);
    return () => clearTimeout(t);
  }, [autoRun, currentRound, rounds, decisions]);

  const totalProfitByTeam = useMemo(() => {
    const sums: number[] = Array(numTeams).fill(0);
    history.forEach(round => round.forEach(res => sums[res.teamId] += res.profit));
    return sums;
  }, [history, numTeams]);

  const rng = useMemo(() => rngWithSeed(seed + currentRound * 9973), [seed, currentRound]);

  function handleDecisionChange(teamIdx: number, field: keyof TeamDecision, value: any) {
    setDecisions(prev => prev.map((d, i) => i === teamIdx ? { ...d, [field]: value } : d));
  }

  function handleBuyChange(teamIdx: number, code: string, qty: number) {
    setDecisions(prev => prev.map((d, i) => i === teamIdx ? { ...d, buy: { ...d.buy, [code]: qty } } : d));
  }

  function runSimulationOneRound(): RoundResult[] {
    const teams = Array.from({ length: numTeams }, (_, i) => i);

    // Build purchase cost & capacities
    const teamCapacity = teams.map(i => Object.entries(decisions[i]?.buy || {}).reduce((acc, [code, qty]) => acc + (Number(qty) || 0), 0));
    const teamCost = teams.map(i => Object.entries(decisions[i]?.buy || {}).reduce((acc, [code, qty]) => {
      const fare = fares.find(f => f.code === code);
      return acc + (Number(qty) || 0) * (fare?.cost ?? 0);
    }, 0));

    const teamPrice = teams.map(i => Number(decisions[i]?.price) || 0);

    const demandSize = Math.max(0, Math.round(rng.normal(baseDemand, Math.max(1, baseDemand * 0.15))));
    const customers = generateCustomers(rng, demandSize, distribution, teamPrice.reduce((a,b)=>a+b,0)/numTeams || 200, spread, shock);

    const sold = Array(numTeams).fill(0);
    const revenue = Array(numTeams).fill(0);

    if (sharedMarket) {
      // Customers choose cheapest available price >= their WTP threshold (simple heuristic)
      // Sort teams by price asc
      const order = teams.slice().sort((a,b) => teamPrice[a] - teamPrice[b]);
      for (const wtp of customers) {
        for (const t of order) {
          if (sold[t] >= teamCapacity[t]) continue; // sold out
          if (wtp >= teamPrice[t]) { // customer accepts
            sold[t] += 1;
            revenue[t] += teamPrice[t];
            break;
          }
        }
      }
    } else {
      // independent markets per team
      for (const t of teams) {
        const custs = generateCustomers(rng, Math.round(demandSize / numTeams), distribution, teamPrice[t], spread, shock);
        for (const wtp of custs) {
          if (sold[t] >= teamCapacity[t]) break;
          if (wtp >= teamPrice[t]) {
            sold[t] += 1;
            revenue[t] += teamPrice[t];
          }
        }
      }
    }

    const results: RoundResult[] = teams.map(t => ({
      teamId: t,
      sold: sold[t],
      revenue: revenue[t],
      cost: teamCost[t],
      profit: revenue[t] - teamCost[t],
      unsold: Math.max(0, teamCapacity[t] - sold[t]),
    }));

    return results;
  }

  function handleRunRound() {
    if (currentRound > rounds) return;
    const roundResults = runSimulationOneRound();
    setHistory(prev => [...prev, roundResults]);
    setCurrentRound(r => r + 1);
  }

  function handleReset() {
    setHistory([]);
    setCurrentRound(1);
    setAutoRun(false);
  }

  function addFareClass() {
    const idx = fares.length + 1;
    const code = String.fromCharCode(64 + ((idx % 26) || 26));
    setFares(prev => [...prev, { code, label: `Fare ${code}`, cost: Math.round(60 + idx * 20) }]);
  }

  const chartData = useMemo(() => {
    return history.map((round, i) => {
      const obj: any = { name: `R${i + 1}` };
      round.forEach(r => {
        obj[`Team ${r.teamId + 1}`] = r.profit;
      });
      return obj;
    });
  }, [history]);

  const leaderboard = useMemo(() => (
    Array.from({ length: numTeams }, (_, i) => ({
      team: i + 1,
      profit: totalProfitByTeam[i] || 0,
    })).sort((a, b) => b.profit - a.profit)
  ), [numTeams, totalProfitByTeam]);

  if (showTutorial) {
    return <Tutorial onStart={() => setShowTutorial(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plane className="w-8 h-8" />
            <h1 className="text-2xl sm:text-3xl font-semibold">Airline Einkaufs- & Nachfrage-Simulation</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleReset}><RefreshCcw className="w-4 h-4 mr-2"/>Reset</Button>
            <Button onClick={() => setAutoRun(v => !v)} variant={autoRun ? "destructive" : "default"}>
              {autoRun ? (<><Pause className="w-4 h-4 mr-2"/>Auto-Stop</>) : (<><Play className="w-4 h-4 mr-2"/>Auto-Run</>)}
            </Button>
            <Button onClick={handleRunRound} disabled={currentRound>rounds}><Play className="w-4 h-4 mr-2"/>Nächste Runde</Button>
          </div>
        </header>

        {/* Top Row: Settings + Leaderboard */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5"/>Leitstand & Parameter</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teams</Label>
                <Slider value={[numTeams]} onValueChange={([v]) => setNumTeams(v)} min={2} max={6} step={1} />
                <div className="text-sm text-slate-600">{numTeams} Teams aktiv</div>
              </div>
              <div className="space-y-2">
                <Label>Runden</Label>
                <Slider value={[rounds]} onValueChange={([v]) => setRounds(v)} min={1} max={12} step={1} />
                <div className="text-sm text-slate-600">Runde {Math.min(currentRound, rounds)} von {rounds}</div>
              </div>

              <div className="space-y-2">
                <Label>Basis-Nachfrage (Kunden)</Label>
                <Slider value={[baseDemand]} onValueChange={([v]) => setBaseDemand(v)} min={20} max={240} step={5} />
                <div className="text-sm text-slate-600">~ {baseDemand} pro Runde</div>
              </div>
              <div className="space-y-2">
                <Label>WTP-Streuung</Label>
                <Slider value={[spread]} onValueChange={([v]) => setSpread(v)} min={5} max={150} step={5} />
                <div className="text-sm text-slate-600">± {spread} (Preis-Sensitivität)</div>
              </div>

              <div className="space-y-2">
                <Label>Random Shock</Label>
                <Slider value={[Math.round(shock*100)]} onValueChange={([v]) => setShock(v/100)} min={0} max={40} step={1} />
                <div className="text-sm text-slate-600">± {Math.round(shock*100)}%</div>
              </div>
              <div className="space-y-2">
                <Label>Seed</Label>
                <Input type="number" value={seed} onChange={e=>setSeed(parseInt(e.target.value||"0"))} />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={sharedMarket} onCheckedChange={setSharedMarket} id="shared" />
                <Label htmlFor="shared">Gemeinsamer Markt (Kunden wählen günstigste Option)</Label>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Fare-Klassen & Einkaufspreise</div>
                  <Button variant="secondary" size="sm" onClick={addFareClass}>+ Fare Klasse</Button>
                </div>
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4 text-sm text-slate-500">Bezeichnung</div>
                  <div className="col-span-3 text-sm text-slate-500">Code</div>
                  <div className="col-span-3 text-sm text-slate-500">Einkaufspreis</div>
                  <div className="col-span-2"></div>
                </div>
                {fares.map((f, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center py-1">
                    <Input className="col-span-4" value={f.label} onChange={e=>setFares(prev=>prev.map((x,i)=>i===idx?{...x,label:e.target.value}:x))} />
                    <Input className="col-span-3" value={f.code} onChange={e=>setFares(prev=>prev.map((x,i)=>i===idx?{...x,code:e.target.value.toUpperCase().slice(0,2)}:x))} />
                    <Input className="col-span-3" type="number" value={f.cost} onChange={e=>setFares(prev=>prev.map((x,i)=>i===idx?{...x,cost:Number(e.target.value)}:x))} />
                    <div className="col-span-2 text-right">
                      <Button variant="ghost" size="sm" onClick={()=>setFares(prev=>prev.filter((_,i)=>i!==idx))}>Entfernen</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Award className="w-5 h-5"/>Leaderboard</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {leaderboard.map((row, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-xl border bg-white/60">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: TEAM_COLORS[(row.team-1)%TEAM_COLORS.length] }} />
                    <span className="font-medium">Team {row.team}</span>
                  </div>
                  <div className="tabular-nums font-semibold">{row.profit.toFixed(0)} €</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Teams */}
        <Tabs defaultValue="teams">
          <TabsList>
            <TabsTrigger value="teams" className="flex items-center gap-2"><Users className="w-4 h-4"/>Teams</TabsTrigger>
            <TabsTrigger value="charts" className="flex items-center gap-2"><LineChart className="w-4 h-4"/>Charts</TabsTrigger>
          </TabsList>
          <TabsContent value="teams">
            <div className="grid md:grid-cols-2 gap-6">
              {Array.from({ length: numTeams }, (_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5"/>Team {i + 1}</CardTitle></CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Endkundenpreis (€)</Label>
                        <Input type="number" value={decisions[i]?.price ?? 199} onChange={e => handleDecisionChange(i, "price", Number(e.target.value))} />
                      </div>
                      <div>
                        <Label>Kapazität (Sitze)</Label>
                        <div className="p-2 rounded-lg bg-slate-50 border tabular-nums">
                          {Object.values(decisions[i]?.buy || {}).reduce((a: any,b: any)=>Number(a)+Number(b),0)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-600 mb-1">Einkauf beim Carrier</div>
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5 text-sm text-slate-500">Fare</div>
                        <div className="col-span-3 text-sm text-slate-500">Preis</div>
                        <div className="col-span-4 text-sm text-slate-500">Menge</div>
                      </div>
                      {fares.map((f, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center py-1">
                          <div className="col-span-5">{f.label} ({f.code})</div>
                          <div className="col-span-3 tabular-nums">{f.cost.toFixed(0)} €</div>
                          <div className="col-span-4">
                            <Input type="number" min={0} value={decisions[i]?.buy?.[f.code] ?? 0} onChange={e => handleBuyChange(i, f.code, Math.max(0, Number(e.target.value)))} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-sm text-slate-600">Tipp: Preis zu hoch → wenig Absatz; Preis zu niedrig → Marge verschenkt.</div>

                    {/* Round-by-round summary for this team */}
                    {history.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="p-2 bg-white/60 border rounded-xl">Verkaufte Sitze: <span className="font-semibold tabular-nums">{history.reduce((acc, r) => acc + (r[i]?.sold || 0), 0)}</span></div>
                        <div className="p-2 bg-white/60 border rounded-xl">Umsatz: <span className="font-semibold tabular-nums">{history.reduce((acc, r) => acc + (r[i]?.revenue || 0), 0).toFixed(0)} €</span></div>
                        <div className="p-2 bg-white/60 border rounded-xl">Kosten: <span className="font-semibold tabular-nums">{history.reduce((acc, r) => acc + (r[i]?.cost || 0), 0).toFixed(0)} €</span></div>
                        <div className="p-2 bg-white/60 border rounded-xl">Gewinn: <span className="font-semibold tabular-nums">{history.reduce((acc, r) => acc + (r[i]?.profit || 0), 0).toFixed(0)} €</span></div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="charts">
            <Card>
              <CardHeader className="pb-2"><CardTitle>Profit je Runde</CardTitle></CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-sm text-slate-600">Noch keine Ergebnisse. Starte eine Runde.</div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(v:any)=>`${v.toFixed? v.toFixed(0):v} €`} />
                        <Legend />
                        {Array.from({ length: numTeams }, (_, i) => (
                          <Bar key={i} dataKey={`Team ${i+1}`} fill={TEAM_COLORS[i%TEAM_COLORS.length]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-slate-500 text-center">
          Ziel: Maximale Gewinnsumme = Umsatz (verkaufte Sitze × Endpreis) − Einkaufskosten (Summe Sitzkäufe je Fare).
          Die Nachfrage entsteht zufällig aus einer WTP-Verteilung. Im gemeinsamen Markt wählen Kunden die günstigste Option.
        </motion.div>
      </div>
    </div>
  );
}
