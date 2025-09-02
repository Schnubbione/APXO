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
          <CardTitle className="text-2xl text-center">Willkommen zur Airline Einkaufs- & Nachfrage-Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Ziel des Spiels</h3>
            <p>
              Als Reisebüro-Teams kauft ihr verschiedene Fare-Klassen bei der Airline ein und setzt Endkundenpreise.
              Simuliert wird die Nachfrage der Kunden basierend auf ihrer Willingness to Pay (WTP).
              Ziel: Den höchsten Gewinn (Umsatz - Einkaufskosten) erzielen!
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Fare-Klassen</h3>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Economy:</strong> Günstig, hohe Nachfrage, niedrige Margen.</li>
              <li><strong>Premium Economy:</strong> Mittelklasse, ausgewogene Nachfrage.</li>
              <li><strong>Business:</strong> Teuer, niedrige Nachfrage, hohe Margen.</li>
              <li><strong>First Class:</strong> Luxus, sehr teuer, geringe Nachfrage.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Spielablauf</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Wählt eure Einkaufsmengen pro Fare-Klasse.</li>
              <li>Setzt Endkundenpreise.</li>
              <li>Startet die Runde – die Simulation berechnet Verkauf und Gewinn.</li>
              <li>Zufallsfaktoren (z. B. Wetter, Wettbewerb) beeinflussen die Nachfrage.</li>
              <li>Spielt mehrere Runden und vergleicht eure Ergebnisse im Leaderboard.</li>
            </ol>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Tipps</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Preis zu hoch → Wenig Verkauf; Preis zu niedrig → Verschenkte Margen.</li>
              <li>Beobachtet die Charts für Trends.</li>
              <li>Nutzt den Seed für reproduzierbare Simulationen.</li>
            </ul>
          </div>

          <div className="text-center">
            <Button onClick={onStart} size="lg">
              Simulation starten
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
