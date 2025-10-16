import React, { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Users, Lightbulb } from 'lucide-react';

type TeamRegistrationProps = {
  onShowTutorial?: () => void;
};

export const TeamRegistration: React.FC<TeamRegistrationProps> = ({ onShowTutorial }) => {
  const {
    registerTeam,
    gameState,
    registrationError,
    startTutorial,
    sessions,
    refreshSessions,
    createSession,
    currentSessionId,
    selectSession,
    socket
  } = useGame();
  const [teamName, setTeamName] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [newSessionName, setNewSessionName] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [showCreateSessionDialog, setShowCreateSessionDialog] = useState(false);
  const selectedSession = sessions.find(session => session.id === selectedSessionId) || null;
  const isViewingSelectedSession = Boolean(selectedSessionId && gameState.sessionId && gameState.sessionId === selectedSessionId);
  const trimmedTeamName = teamName.trim();

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (currentSessionId) {
      setSelectedSessionId(currentSessionId);
      return;
    }
    if (sessions.length > 0 && !selectedSessionId) {
      const firstId = sessions[0].id;
      setSelectedSessionId(firstId);
      if (socket) {
        selectSession(firstId);
      }
    } else if (selectedSessionId && sessions.length > 0 && !sessions.some(session => session.id === selectedSessionId)) {
      const fallback = sessions[0].id;
      setSelectedSessionId(fallback);
      if (socket) {
        selectSession(fallback);
      }
    }
  }, [sessions, selectedSessionId, currentSessionId, selectSession, socket]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError(null);
    const trimmed = teamName.trim();
    if (!trimmed) {
      return;
    }
    if (!selectedSessionId) {
      setSessionError('Please choose a session.');
      return;
    }
    registerTeam(trimmed, selectedSessionId);
    setTeamName('');
  };

  const handleCreateSession = () => {
    setSessionError(null);
    const trimmed = newSessionName.trim();
    if (!trimmed) {
      setSessionError('Please enter a session name.');
      return;
    }
    createSession(trimmed, (result) => {
      if (result.ok && result.session) {
        setNewSessionName('');
        setSelectedSessionId(result.session.id);
        setSessionError(null);
        if (socket) {
          selectSession(result.session.id);
        }
        refreshSessions();
        setShowCreateSessionDialog(false);
      } else if (result.error) {
        setSessionError(result.error);
      }
    });
  };

  const handleShowTutorial = () => {
    // Prefer the full tutorial page if provided, fallback to interactive tour
    if (onShowTutorial) {
      onShowTutorial();
    } else {
      startTutorial();
    }
  };

  const handleStartTour = () => {
    startTutorial();
  };

  const isRoundActive = selectedSession ? selectedSession.isActive : gameState.isActive;
  const canJoin = !isRoundActive && Boolean(trimmedTeamName) && Boolean(selectedSessionId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {showCreateSessionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-slate-800/95 border border-slate-700 shadow-2xl">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-xl text-white">Create a new session</CardTitle>
              <CardDescription className="text-slate-400">
                Name your lobby. The first team joining becomes the session owner.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-session" className="text-slate-300 text-sm font-medium">Session name</Label>
                <Input
                  id="new-session"
                  type="text"
                  placeholder="Workshop lobby, Practice group…"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-slate-500 focus:ring-slate-400/30 text-lg min-h-[48px] rounded-xl"
                />
              </div>
              {sessionError && (
                <div className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {sessionError}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleCreateSession}
                  className="flex-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-700 hover:from-indigo-600 hover:via-purple-600 hover:to-purple-800 text-white font-semibold min-h-[48px] rounded-xl shadow-lg transition-all duration-200"
                >
                  Create session
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateSessionDialog(false);
                    setSessionError(null);
                    setNewSessionName('');
                  }}
                  className="flex-1 border-slate-500 text-white hover:bg-slate-700/60 min-h-[48px] rounded-xl transition-all duration-200"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <Card className="w-full max-w-md bg-slate-800/90 backdrop-blur-sm border-slate-700 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-slate-600 to-slate-800 rounded-2xl shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white mb-2">
            Join the Simulation
          </CardTitle>
          <CardDescription className="text-slate-400 text-base">
            {isRoundActive ? (
              <span className="text-orange-400 font-medium">
                ⚠️ A round is currently in progress. You can join after the current round ends.
              </span>
            ) : (
              "Enter your team name to participate in the Allotment Procurement & Demand Simulation"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" data-tutorial="team-registration">
            <div className="space-y-3" data-tutorial="session-selector">
              <Label className="text-slate-300 text-sm font-medium">Select a session</Label>
              {sessions.length === 0 ? (
                <div className="text-sm text-slate-400 bg-slate-700/40 border border-slate-600/50 rounded-lg p-3">
                  No sessions available yet. Create one below.
                </div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {sessions.map((session) => {
                    const isSelected = session.id === selectedSessionId;
                    return (
                      <button
                        type="button"
                        key={session.id}
                        onClick={() => {
                          setSelectedSessionId(session.id);
                          selectSession(session.id);
                          setSessionError(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition-all duration-200 ${
                          isSelected
                            ? 'border-indigo-400/70 bg-indigo-500/20 text-white shadow-lg'
                            : 'border-slate-600/50 bg-slate-700/40 text-slate-200 hover:bg-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span>{session.name}</span>
                          <span className="text-xs text-slate-400">
                            {session.teamCount} team{session.teamCount === 1 ? '' : 's'}
                          </span>
                        </div>
                        {session.isActive && (
                          <div className="text-xs text-emerald-300 mt-1">Phase active</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSessionError(null);
                    setNewSessionName('');
                    setShowCreateSessionDialog(true);
                  }}
                  className="px-3 py-2 text-sm bg-slate-800/70 border-slate-600 text-slate-200 hover:bg-slate-700/70"
                >
                  New session
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={refreshSessions}
                  className="px-3 py-2 text-sm bg-slate-800/70 border-slate-600 text-slate-200 hover:bg-slate-700/70"
                >
                  Refresh sessions
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="teamName" className="text-slate-300 text-sm font-medium">Team Name</Label>
              <Input
                id="teamName"
                type="text"
                placeholder={isRoundActive ? "Please wait for current round to end..." : "Enter your team name"}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                disabled={isRoundActive}
                className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-slate-500 focus:ring-slate-400/30 text-lg min-h-[52px] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {(sessionError || registrationError) && (
                <div className="space-y-2">
                  {sessionError && (
                    <div className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      {sessionError}
                    </div>
                  )}
                  {registrationError && (
                    <div className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      {registrationError}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-700 hover:from-indigo-600 hover:via-purple-600 hover:to-purple-800 text-white font-semibold text-lg min-h-[52px] rounded-xl shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!canJoin}
              data-tutorial="join-button"
            >
              {isRoundActive ? 'Session in progress - please wait' : 'Join session'}
            </Button>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={handleStartTour}
                variant="outline"
                className="flex-1 bg-gradient-to-r from-green-500/20 to-emerald-600/20 border-green-500/50 text-green-300 hover:bg-green-500/30 hover:text-green-200 font-medium min-h-[44px] rounded-xl transition-all duration-200"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                Take Tour
              </Button>
              <Button
                type="button"
                onClick={handleShowTutorial}
                variant="outline"
                className="flex-1 bg-slate-700/50 border-slate-500 text-white hover:bg-slate-600/50 font-medium min-h-[44px] rounded-xl transition-all duration-200"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                Show Tutorial
              </Button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-600">
            <div className="text-slate-300 text-sm font-medium mb-4">
              {selectedSession ? `Teams in "${selectedSession.name}"` : 'Teams in the selected session'}
            </div>
            {!selectedSessionId ? (
              <div className="text-slate-500 text-center py-4">Select a session to view registered teams.</div>
            ) : isViewingSelectedSession ? (
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {gameState.teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50 hover:bg-slate-700/50 transition-all duration-200"
                  >
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                    <span className="text-white font-medium">{team.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 text-center py-4">
                {selectedSession ? `${selectedSession.teamCount} team${selectedSession.teamCount === 1 ? '' : 's'} registered` : 'No teams available'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
