import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface TeamRegistrationProps {
  onTeamsRegistered: (teams: string[]) => void;
  totalAircraftSeats?: number;
}

export default function TeamRegistration({ onTeamsRegistered, totalAircraftSeats = 1000 }: TeamRegistrationProps) {
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
          <CardTitle className="text-2xl text-center">Team Registration</CardTitle>
          <p className="text-center text-slate-600">Enter the names of the participating teams.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {teamNames.map((name, index) => {
            const validTeams = teamNames.filter(n => n.trim() !== "").length;
            const hotelCapacityPerTeam = validTeams > 0 ? Math.floor((totalAircraftSeats * 0.6) / validTeams) : 0;
            
            return (
              <div key={index} className="flex gap-2">
                <Label className="flex items-center min-w-[80px]">Team {index + 1}:</Label>
                <Input
                  value={name}
                  onChange={(e) => handleTeamNameChange(index, e.target.value)}
                  placeholder={`Team ${index + 1} Name`}
                />
                {name.trim() && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <span className="text-xs">🏨 {hotelCapacityPerTeam} beds</span>
                  </Badge>
                )}
                {teamNames.length > 2 && (
                  <Button variant="outline" size="sm" onClick={() => removeTeam(index)}>
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
          
          {teamNames.filter(n => n.trim() !== "").length > 0 && (
            <div className="p-3 bg-slate-50 rounded-lg border">
              <div className="text-sm text-slate-600">
                <div className="font-medium mb-1">Market Configuration:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Total Aircraft Seats: <span className="font-semibold">{totalAircraftSeats}</span></div>
                  <div>Active Teams: <span className="font-semibold">{teamNames.filter(n => n.trim() !== "").length}</span></div>
                  <div className="col-span-2">
                    Hotel Beds per Team: <span className="font-semibold text-indigo-600">
                      {Math.floor((totalAircraftSeats * 0.6) / Math.max(1, teamNames.filter(n => n.trim() !== "").length))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={addTeam}>
              Add Team
            </Button>
            <Button onClick={handleSubmit} disabled={teamNames.filter(n => n.trim()).length < 2}>
              Register Teams
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
