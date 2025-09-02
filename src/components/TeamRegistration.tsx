import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TeamRegistrationProps {
  onTeamsRegistered: (teams: string[]) => void;
}

export default function TeamRegistration({ onTeamsRegistered }: TeamRegistrationProps) {
  const [teamNames, setTeamNames] = useState<string[]>(["", "", "", ""]);

  const handleTeamNameChange = (index: number, name: string) => {
    const newNames = [...teamNames];
    newNames[index] = name;
    setTeamNames(newNames);
  };

  const handleSubmit = () => {
    const validTeams = teamNames.filter(name => name.trim() !== "");
    if (validTeams.length >= 2) {
      onTeamsRegistered(validTeams);
    }
  };

  const addTeam = () => {
    setTeamNames([...teamNames, ""]);
  };

  const removeTeam = (index: number) => {
    if (teamNames.length > 2) {
      setTeamNames(teamNames.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Team-Registrierung</CardTitle>
          <p className="text-center text-slate-600">Geben Sie die Namen der teilnehmenden Teams ein.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {teamNames.map((name, index) => (
            <div key={index} className="flex gap-2">
              <Label className="flex items-center min-w-[80px]">Team {index + 1}:</Label>
              <Input
                value={name}
                onChange={(e) => handleTeamNameChange(index, e.target.value)}
                placeholder={`Team ${index + 1} Name`}
              />
              {teamNames.length > 2 && (
                <Button variant="outline" size="sm" onClick={() => removeTeam(index)}>
                  Entfernen
                </Button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={addTeam}>
              Team hinzufügen
            </Button>
            <Button onClick={handleSubmit} disabled={teamNames.filter(n => n.trim()).length < 2}>
              Teams registrieren
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
