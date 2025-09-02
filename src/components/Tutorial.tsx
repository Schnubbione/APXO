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
            <h3 className="text-lg font-semibold mb-2">Fare Classes</h3>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Economy:</strong> Cheap, high demand, low margins.</li>
              <li><strong>Premium Economy:</strong> Mid-range, balanced demand.</li>
              <li><strong>Business:</strong> Expensive, low demand, high margins.</li>
              <li><strong>First Class:</strong> Luxury, very expensive, minimal demand.</li>
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
