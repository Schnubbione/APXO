import { calculateRoundResults } from '../calc.js';

test('calculateRoundResults returns required fields per team', () => {
  // Minimal team shape required by calculateRoundResults
  const teams = [
    { id: 'T1', name: 'Team 1', decisions: { price: 500, fixSeatsPurchased: 10, poolingAllocation: 20 } },
    { id: 'T2', name: 'Team 2', decisions: { price: 210, fixSeatsPurchased: 5, poolingAllocation: 30 } },
  ];
  const settings = {
    baseDemand: 100,
    totalAircraftSeats: 1000,
    poolingMarket: { currentPrice: 150 }
  };

  const results = calculateRoundResults(teams, settings);
  expect(Array.isArray(results)).toBe(true);
  expect(results.length).toBe(2);

  for (const r of results) {
    expect(r).toHaveProperty('teamId');
    expect(r).toHaveProperty('sold');
    expect(r).toHaveProperty('revenue');
    expect(r).toHaveProperty('cost');
    expect(r).toHaveProperty('profit');
    expect(r).toHaveProperty('unsold');
    expect(r).toHaveProperty('marketShare');
    expect(r).toHaveProperty('demand');
    expect(r).toHaveProperty('avgPrice');
    expect(r).toHaveProperty('capacity');
  }
});
