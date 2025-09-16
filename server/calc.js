// Pure calculation helpers used by the server and tests

// Generate normal distributed random number using Box-Muller transform
export function generateNormalRandom(mean = 0, stdDev = 1) {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z0 * stdDev + mean;
}

// Calculate market shares based on economic principles
export function calculateMarketShares(teams, settings) {
  const shares = {};
  if (teams.length === 0) return shares;

  // Calculate price competitiveness for each team using price elasticity
  const priceElasticity = settings.priceElasticity || -1.5;
  const basePrice = 199; // Reference price (retail)

  const priceCompetitiveness = teams.map(team => {
    const retailPrice = getRetailPrice(team);
    const ratio = Math.max(0.1, Math.min(3.0, (retailPrice || basePrice) / basePrice));
    const elasticityFactor = Math.pow(ratio, priceElasticity);
    return Math.max(0.05, Math.min(3.0, elasticityFactor)); // Bound
  });

  // Calculate capacity factor (more capacity = more market presence)
  const capacityFactors = teams.map(team => {
    const capacity = calculateTeamCapacity(team, settings);
    return Math.max(0.1, Math.min(2.0, capacity / 50));
  });

  // Combine price and capacity factors
  const combinedFactors = priceCompetitiveness.map((priceFactor, index) => priceFactor * capacityFactors[index]);

  // Total combined competitiveness
  const totalCompetitiveness = combinedFactors.reduce((sum, factor) => sum + factor, 0);

  // Market shares with slight stochastic variation
  teams.forEach((team, index) => {
    const rawShare = combinedFactors[index] / totalCompetitiveness;
    const concentration = settings.marketConcentration || 0.7;
    const stochasticFactor = 0.85 + Math.random() * 0.3; // 0.85..1.15
    shares[team.id] = Math.max(0.01, Math.min(0.99, rawShare * stochasticFactor));
  });

  // Normalize
  const totalShares = Object.values(shares).reduce((sum, share) => sum + share, 0);
  Object.keys(shares).forEach(teamId => {
    shares[teamId] = shares[teamId] / totalShares;
  });

  return shares;
}

// Average retail price used for reporting
export function getRetailPrice(team) {
  return team?.decisions?.price || 199;
}
export function calculateAveragePrice(team) {
  return getRetailPrice(team);
}

// Team capacity from fix seats + pooling allocation
export function calculateTeamCapacity(team, settings = {}) {
  const fixSeats = team.decisions?.fixSeatsAllocated ?? team.decisions?.fixSeatsPurchased ?? 0;
  const poolingAllocation = (team.decisions?.poolingAllocation || 0) / 100;
  const totalCapacity = settings.totalAircraftSeats || 1000;
  const poolingCapacity = Math.round(totalCapacity * poolingAllocation);
  return fixSeats + poolingCapacity;
}

export function calculateRevenue(team, sold) {
  const price = team.decisions?.price || 199;
  return sold * price;
}

export function calculateCosts(team, sold, settings = {}) {
  const fixSeatsPurchased = team.decisions?.fixSeatsPurchased || 0;
  const clearingPrice = Number.isFinite(Number(team.decisions?.fixSeatClearingPrice)) && Number(team.decisions.fixSeatClearingPrice) > 0
    ? Number(team.decisions.fixSeatClearingPrice)
    : (settings.fixSeatPrice || 60);
  const fixSeatCost = fixSeatsPurchased * clearingPrice;
  let totalCost = fixSeatCost;

  const totalCapacity = calculateTeamCapacity(team, settings);
  const fixedCosts = totalCapacity * 20;
  const variableCosts = sold * 15;

  const totalCapacitySetting = settings.totalAircraftSeats || 1000;
  const poolingAllocation = (team.decisions?.poolingAllocation || 0) / 100;
  const poolingCapacity = Math.round(totalCapacitySetting * poolingAllocation);
  const fixSeats = team.decisions?.fixSeatsPurchased || 0;
  const pooledUsed = Math.max(0, Math.min(poolingCapacity, sold - Math.min(sold, fixSeats)));
  const poolingUnitCost = (settings.poolingMarket && typeof settings.poolingMarket.currentPrice === 'number')
    ? settings.poolingMarket.currentPrice
    : (typeof settings.poolingCost === 'number' ? settings.poolingCost : 30);
  const poolingUsageCost = pooledUsed * poolingUnitCost;

  const hotelCapacity = team.decisions?.hotelCapacity || 0;
  const hotelBedCost = typeof settings.hotelBedCost === 'number' ? settings.hotelBedCost : 50;
  const usedBeds = Math.min(sold, hotelCapacity);
  const emptyBeds = Math.max(0, hotelCapacity - usedBeds);
  const hotelEmptyBedCost = emptyBeds * hotelBedCost;

  const costVolatility = typeof settings.costVolatility === 'number' ? settings.costVolatility : 0.05;
  const costMultiplier = 1 + generateNormalRandom(0, costVolatility);
  const scaleFactor = Math.max(0.85, Math.min(1.0, 1 - ((settings.totalAircraftSeats || 1000) / 200) * 0.1));

  return (totalCost + fixedCosts + variableCosts + poolingUsageCost + hotelEmptyBedCost) * costMultiplier * scaleFactor;
}

export function calculateRoundResults(teams, settings) {
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
  const marketPriceElasticity = (typeof settings.marketPriceElasticity === 'number')
    ? settings.marketPriceElasticity
    : ((typeof settings.priceElasticity === 'number' ? settings.priceElasticity * 0.6 : -0.9));

  const demandBase = baseDemand * (1 + demandShock) * seasonalFactor;
  const totalDemand = Math.max(10, Math.round(demandBase * Math.pow(priceIndex, marketPriceElasticity)));

  const marketShares = calculateMarketShares(teams, settings);

  return teams.map((team, idx) => {
    const teamShare = marketShares[team.id] || 0;
    const teamDemand = Math.round(totalDemand * teamShare);

    const capacity = calculateTeamCapacity(team, settings);
    const sold = Math.min(teamDemand, capacity);
    const revenue = calculateRevenue(team, sold);
    const cost = calculateCosts(team, sold, settings);
    const profit = revenue - cost;

    return {
      teamId: team.id,
      sold: sold,
      revenue: Math.round(revenue),
      cost: Math.round(cost),
      profit: Math.round(profit),
      unsold: Math.max(0, teamDemand - sold),
      marketShare: Math.round(teamShare * 100) / 100,
      demand: teamDemand,
      avgPrice: calculateAveragePrice(team),
      capacity: capacity
    };
  });
}

export default {
  calculateRoundResults,
  calculateMarketShares,
  calculateTeamCapacity,
  calculateRevenue,
  calculateCosts,
  getRetailPrice,
  generateNormalRandom,
};
