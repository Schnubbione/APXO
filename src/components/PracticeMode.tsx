import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type PracticeTeam = {
  id: number;
  name: string;
  decisions: {
    price: number;
    buy: { F: number; P: number; O: number };
    fixSeatsPurchased?: number; // for parity with server model
    fixSeatsAllocated?: number;
    poolingAllocation: number; // percent 0..100
    hotelCapacity?: number;
  };
  totalProfit: number;
};

type PracticeSettings = {
  baseDemand: number;
  demandVolatility: number;
  priceElasticity: number; // negative
  marketConcentration: number;
  totalCapacity: number;
  fixSeatPrice: number;
  hotelBedCost: number;
  costVolatility: number;
  poolingMarket?: { currentPrice: number };
};

export function PracticeMode({
  onClose,
  humanTeamName,
}: {
  onClose: () => void;
  humanTeamName: string;
}) {
  const [teams, setTeams] = useState<PracticeTeam[]>([]);
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [results, setResults] = useState<any[] | null>(null);
  const [initialPrice, setInitialPrice] = useState<number>(199);
  const [hasStarted, setHasStarted] = useState(false);

  // Init random scenario
  useEffect(() => {
    const rng = mulberry32(Date.now() & 0xffffffff);
    const aiCount = 2 + Math.floor(rng() * 4); // 2..5

    const s: PracticeSettings = {
      baseDemand: 80 + Math.floor(rng() * 160), // 80..239
      demandVolatility: 0.05 + rng() * 0.15, // 0.05..0.2
      priceElasticity: -(0.9 + rng() * 1.8), // -0.9..-2.7
      marketConcentration: 0.6 + rng() * 0.3,
      totalCapacity: 600 + Math.floor(rng() * 800), // 600..1399
      fixSeatPrice: 50 + Math.floor(rng() * 30), // 50..79
      hotelBedCost: 30 + Math.floor(rng() * 40), // 30..69
      costVolatility: 0.03 + rng() * 0.07,
      poolingMarket: { currentPrice: 120 + Math.floor(rng() * 100) },
    };

    // Build human + AI teams with random decisions
    const newTeams: PracticeTeam[] = [];
    const makeAIName = (i: number) => `AI Team ${i + 1}`;
    newTeams.push({
      id: 1,
      name: humanTeamName,
      decisions: {
        price: initialPrice,
        buy: { F: Math.floor(rng() * 150), P: Math.floor(rng() * 80), O: Math.floor(rng() * 40) },
        fixSeatsPurchased: 0,
        poolingAllocation: Math.floor(rng() * 60),
        hotelCapacity: Math.floor((s.totalCapacity * 0.6) / (aiCount + 1)),
      },
      totalProfit: 0,
    });
    for (let i = 0; i < aiCount; i++) {
      newTeams.push({
        id: i + 2,
        name: makeAIName(i),
        decisions: {
          price: 150 + Math.floor(rng() * 200),
          buy: { F: Math.floor(rng() * 180), P: Math.floor(rng() * 100), O: Math.floor(rng() * 60) },
          fixSeatsPurchased: 0,
          poolingAllocation: Math.floor(rng() * 70),
          hotelCapacity: Math.floor((s.totalCapacity * 0.6) / (aiCount + 1)),
        },
        totalProfit: 0,
      });
    }

    setSettings(s);
    setTeams(newTeams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [humanTeamName]);

  // Update human initial price before start
  useEffect(() => {
    if (!teams.length) return;
    setTeams(prev => prev.map(t => t.id === 1 ? { ...t, decisions: { ...t.decisions, price: initialPrice } } : t));
  }, [initialPrice]);

  const startAndRun = async () => {
    if (!settings) return;
    setHasStarted(true);
    // Single auto round using server-like logic
    const rr = calculateRoundResults(teams, settings);
    setResults(rr);
  };

  const leaderboard = useMemo(() => {
    if (!results) return [];
    return results
      .map(r => ({ name: teams.find(t => t.id === r.teamId)?.name || String(r.teamId), profit: r.profit }))
      .sort((a, b) => b.profit - a.profit);
  }, [results, teams]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-slate-800/95 border-slate-600 text-white">
        <CardHeader>
          <CardTitle>Practice Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!hasStarted && (
            <div className="space-y-4">
              <div className="text-slate-300 text-sm">
                Compete against randomly generated AI teams. Rounds start automatically; parameters are randomized.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300 text-sm">Your Initial Price (€)</Label>
                  <Input type="number" value={initialPrice} onChange={e => setInitialPrice(Number(e.target.value || 0))}
                         className="bg-slate-700/50 border-slate-600 text-white"/>
                </div>
                <div className="text-sm text-slate-400">
                  Opponents: {teams.length > 0 ? teams.length - 1 : '—'}
                  <br/>Base Demand: {settings?.baseDemand ?? '—'}
                  <br/>Total Capacity: {settings?.totalCapacity ?? '—'}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={startAndRun} className="bg-gradient-to-r from-indigo-500 to-purple-600">Start Practice</Button>
                <Button variant="outline" onClick={onClose} className="border-slate-500 text-slate-200">Close</Button>
              </div>
            </div>
          )}

          {hasStarted && !results && (
            <div className="text-slate-300">Running simulation…</div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="text-lg font-semibold">Results</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map(r => (
                  <div key={r.teamId} className="p-3 bg-slate-700/40 rounded border border-slate-600">
                    <div className="font-medium">{teams.find(t => t.id === r.teamId)?.name}</div>
                    <div className="text-sm text-slate-300">Sold: {r.sold} | Demand: {r.demand} | Capacity: {r.capacity}</div>
                    <div className="text-sm text-green-400">Profit: €{r.profit}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-2">Leaderboard</div>
                <div className="space-y-2">
                  {leaderboard.map((e, i) => (
                    <div key={e.name} className="flex items-center justify-between p-2 bg-slate-700/40 rounded border border-slate-600">
                      <div className="flex items-center gap-2"><span className="w-6 text-center">{i + 1}.</span>{e.name}</div>
                      <div className="font-semibold text-green-400">€{e.profit.toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={onClose} className="bg-gradient-to-r from-indigo-500 to-purple-600">Finish</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ================= Logic mirrored from server =================
function calculateRoundResults(teams: PracticeTeam[], settings: PracticeSettings) {
  const baseDemand = settings.baseDemand || 100;
  const demandVolatility = settings.demandVolatility || 0.1;

  const demandShock = generateNormalRandom(0, demandVolatility);
  const seasonalFactor = 0.9 + Math.random() * 0.2;

  const basePrice = 199;
  const capacities = teams.map(t => calculateTeamCapacity(t, settings));
  const totalCapacity = Math.max(1, capacities.reduce((a, b) => a + b, 0));
  const weightedPriceSum = teams.reduce((sum, team, i) => sum + (getRetailPrice(team) * (capacities[i] || 0)), 0);
  const marketWeightedPrice = weightedPriceSum / totalCapacity;
  const priceIndex = Math.max(0.5, Math.min(1.5, (marketWeightedPrice || basePrice) / basePrice));
  const marketPriceElasticity = (typeof (settings as any).marketPriceElasticity === 'number')
    ? (settings as any).marketPriceElasticity as number
    : (settings.priceElasticity * 0.6);

  const demandBase = baseDemand * (1 + demandShock) * seasonalFactor;
  const totalDemand = Math.max(10, Math.round(demandBase * Math.pow(priceIndex, marketPriceElasticity)));

  const marketShares = calculateMarketShares(teams, settings);

  return teams.map((team) => {
    const teamShare = marketShares.get(team.id) || 0;
    const teamDemand = Math.round(totalDemand * teamShare);

    const capacity = calculateTeamCapacity(team, settings);
    const sold = Math.min(teamDemand, capacity);
    const revenue = calculateRevenue(team, sold);
    const cost = calculateCosts(team, sold, settings);
    const profit = revenue - cost;

    return {
      teamId: team.id,
      sold,
      revenue: Math.round(revenue),
      cost: Math.round(cost),
      profit: Math.round(profit),
      unsold: Math.max(0, teamDemand - sold),
      marketShare: Math.round(teamShare * 100) / 100,
      demand: teamDemand,
      avgPrice: getRetailPrice(team),
      capacity
    };
  });
}

function calculateMarketShares(teams: PracticeTeam[], settings: PracticeSettings) {
  const shares = new Map<number, number>();
  if (teams.length === 0) return shares;

  const priceElasticity = settings.priceElasticity || -1.5;
  const basePrice = 199;

  const priceCompetitiveness = teams.map(team => {
    const retailPrice = getRetailPrice(team);
    const ratio = Math.max(0.1, Math.min(3.0, (retailPrice || basePrice) / basePrice));
    const elasticityFactor = Math.pow(ratio, priceElasticity);
    return Math.max(0.05, Math.min(3.0, elasticityFactor));
  });

  const capacityFactors = teams.map(team => {
    const capacity = calculateTeamCapacity(team, settings);
    return Math.max(0.1, Math.min(2.0, capacity / 50));
  });

  const combinedFactors = priceCompetitiveness.map((pf, i) => pf * capacityFactors[i]);
  const totalComb = combinedFactors.reduce((s, v) => s + v, 0) || 1;

  teams.forEach((team, i) => {
    const raw = combinedFactors[i] / totalComb;
    const stochastic = 0.85 + Math.random() * 0.3;
    shares.set(team.id, Math.max(0.01, Math.min(0.99, raw * stochastic)));
  });

  const sum = Array.from(shares.values()).reduce((a, b) => a + b, 0) || 1;
  shares.forEach((v, k) => shares.set(k, v / sum));
  return shares;
}

function getRetailPrice(team: PracticeTeam) {
  return team?.decisions?.price || 199;
}

function calculateTeamCapacity(team: PracticeTeam, settings?: PracticeSettings) {
  const buy = team.decisions.buy || { F: 0, P: 0, O: 0 };
  const purchased = Object.values(buy).reduce((sum, c) => sum + (c || 0), 0);
  const poolingAllocation = (team.decisions.poolingAllocation || 0) / 100;
  const totalCapacity = settings?.totalCapacity || 1000;
  const poolingCapacity = Math.round(totalCapacity * poolingAllocation);
  return purchased + poolingCapacity;
}

function calculateRevenue(team: PracticeTeam, sold: number) {
  const price = team.decisions.price || 199;
  return sold * price;
}

function calculateCosts(team: PracticeTeam, sold: number, settings: PracticeSettings) {
  const buy = team.decisions.buy || { F: 0, P: 0, O: 0 };
  const fares = [
    { code: 'F', cost: 60 },
    { code: 'P', cost: 85 },
    { code: 'O', cost: 110 },
  ] as const;

  let totalCost = 0;
  fares.forEach(f => { totalCost += (buy[f.code] || 0) * f.cost; });

  const totalCapacity = calculateTeamCapacity(team, settings);
  const fixedCosts = totalCapacity * 20;
  const variableCosts = sold * 15;

  const totalCapacitySetting = settings.totalCapacity || 1000;
  const poolingAllocation = (team.decisions.poolingAllocation || 0) / 100;
  const poolingCapacity = Math.round(totalCapacitySetting * poolingAllocation);
  const fixSeats = team.decisions.buy.F || 0; // approximate as fix seats
  const pooledUsed = Math.max(0, Math.min(poolingCapacity, sold - Math.min(sold, fixSeats)));
  const poolingUnitCost = settings.poolingMarket?.currentPrice ?? 30;
  const poolingUsageCost = pooledUsed * poolingUnitCost;

  const hotelCapacity = team.decisions.hotelCapacity || 0;
  const hotelBedCost = settings.hotelBedCost ?? 50;
  const usedBeds = Math.min(sold, hotelCapacity);
  const emptyBeds = Math.max(0, hotelCapacity - usedBeds);
  const hotelEmptyBedCost = emptyBeds * hotelBedCost;

  const costVolatility = settings.costVolatility ?? 0.05;
  const costMultiplier = 1 + generateNormalRandom(0, costVolatility);
  const scaleFactor = Math.max(0.85, Math.min(1.0, 1 - (totalCapacity / 200) * 0.1));

  return (totalCost + fixedCosts + variableCosts + poolingUsageCost + hotelEmptyBedCost) * costMultiplier * scaleFactor;
}

function generateNormalRandom(mean = 0, stdDev = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z0 * stdDev + mean;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default PracticeMode;
