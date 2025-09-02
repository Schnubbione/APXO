import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TutorialProps {
  onStart: () => void;
}

export default function Tutorial({ onStart }: TutorialProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome to the Airline Procurement & Demand Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Game Objective</h3>
            <p>
              As travel agency teams, you purchase different fare classes from the airline and set end-customer prices.
              Customer demand is simulated based on their Willingness to Pay (WTP).
              Goal: Achieve the highest profit (revenue - procurement costs)!
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Procurement Products</h3>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Fix:</strong> Cheapest option (€60/seat), but must be paid regardless of demand. Lowest risk for airline, highest risk for tour operator.</li>
              <li><strong>ProRata:</strong> More expensive (€85/seat), but can be returned until 60 days before departure if not booked. Medium risk for both parties.</li>
              <li><strong>Pooling:</strong> Highest price (€110/seat), daily price and availability updates, not guaranteed, only paid if actual demand exists. Highest risk for airline, lowest risk for tour operator.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Game Flow</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Select your procurement quantities per fare class.</li>
              <li>Set end-customer prices.</li>
              <li>Start the round – the simulation calculates sales and profit.</li>
              <li>Random factors (e.g., weather, competition) influence demand.</li>
              <li>Play multiple rounds and compare your results in the leaderboard.</li>
            </ol>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Tips</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Price too high → Low sales; Price too low → Wasted margins.</li>
              <li>Watch the charts for trends.</li>
              <li>Use the seed for reproducible simulations.</li>
            </ul>
          </div>

          <div className="text-center">
            <Button onClick={onStart} size="lg">
              Start Simulation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
