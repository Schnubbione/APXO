import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Play, SkipForward } from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for highlighting
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
}

interface TutorialTourProps {
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  currentStep: number;
  onStepChange: (step: number) => void;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
  title: 'Welcome to Allotment Procurement & Demand Simulation!',
    description: 'This interactive tutorial will guide you through the game mechanics. Let\'s learn how to play!',
    position: 'center'
  },
  {
    id: 'game-objective',
    title: 'Game Objective',
    description: 'As tour operator teams, you compete to maximize profits through strategic procurement and pricing decisions in a two-phase game.',
    position: 'center'
  },
  {
    id: 'two-phases',
    title: 'Two-Phase System',
    description: 'Phase 1: Fixed-seat auction – submit one pay-as-bid offer while rival bids stay hidden. Phase 2: Live market – a continuous countdown to departure where you steer price, optional push level, fixed-seat hold, and tools while sales consume fixed seats first before pulling from the airline at the live pooling price.',
    position: 'center'
  },
  {
    id: 'team-registration',
    title: 'Team Registration',
    description: 'Enter your team name to join the simulation. Each team competes independently with their own strategies.',
    target: '[data-tutorial="team-registration"]',
    position: 'bottom'
  },
  {
    id: 'admin-controls',
    title: 'Admin Controls',
    description: 'Administrators can start phases, manage settings, and monitor all teams from the admin panel.',
    target: '[data-tutorial="admin-login"]',
    position: 'bottom'
  },
  {
    id: 'phase-status',
    title: 'Phase Status',
    description: 'Monitor the current game phase and time remaining. The timer shows how much time is left in each phase.',
    target: '[data-tutorial="phase-status"]',
    position: 'top'
  },
  {
    id: 'team-decisions',
    title: 'Your Decisions',
    description: 'Phase 1: Choose quantity and maximum seat price – pay-as-bid with hidden availability. Phase 2: Throughout the countdown you adjust retail price (guarded to ±10%), optional push level, fixed-seat hold %, and tools (hedge, spotlight, commit); pooling seats are auto-purchased only when you sell.',
    target: '[data-tutorial="team-decisions"]',
    position: 'top'
  },
  {
    id: 'pooling-market',
    title: 'Live Pooling Market',
    description: 'Live updates highlight airline price, remaining capacity, and standings while the countdown keeps running. Pooling seats are bought automatically only when your price wins a sale; the airline price stays within configured bounds and reacts to forecast gaps.',
    target: '[data-tutorial="pooling-market"]',
    position: 'top'
  },
  {
    id: 'market-insights',
    title: 'Market Intelligence & Strategic Decision-Making',
  description: 'Use market intelligence under information asymmetry. Exact fix availability is hidden in Phase 1 — watch signals and make risk-aware decisions. Balance guaranteed capacity vs. flexible options while staying mindful of your retail margin.',
    position: 'center'
  },
  {
    id: 'leaderboard',
    title: 'Live Leaderboard',
    description: 'Track your performance and see how you rank against other teams in real-time.',
    target: '[data-tutorial="leaderboard"]',
    position: 'left'
  },
  {
    id: 'ready-to-play',
    title: 'Ready to Play!',
    description: 'You are ready! Phase 1 rewards smart risk management under information asymmetry, Phase 2 is won with consistent execution across the continuous countdown. Watch the price guard, tool cooldowns, and pooling costs – victory requires profit and positive unit margins.',
    position: 'center'
  }
];

export default function TutorialTour({
  isActive,
  onComplete,
  onSkip,
  currentStep,
  onStepChange
}: TutorialTourProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [stableStep, setStableStep] = useState(currentStep);

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
      // Ensure currentStep is within valid range
      const validStep = Math.max(0, Math.min(currentStep, tutorialSteps.length - 1));
      setStableStep(validStep);
    } else {
      setIsVisible(false);
    }
  }, [isActive, currentStep]);

  // Update stable step when currentStep changes, but only if tutorial is active
  useEffect(() => {
    if (isActive && currentStep >= 0 && currentStep < tutorialSteps.length) {
      setStableStep(currentStep);
    }
  }, [currentStep, isActive]);

  if (!isActive || !isVisible || tutorialSteps.length === 0) return null;

  const currentTutorialStep = tutorialSteps[stableStep];
  const isFirstStep = stableStep === 0;
  const isLastStep = stableStep === tutorialSteps.length - 1;

  // Safety check - if currentTutorialStep is undefined or stableStep is out of bounds, return null
  if (!currentTutorialStep || stableStep < 0 || stableStep >= tutorialSteps.length) {
    console.warn('Tutorial step not found or out of bounds:', stableStep, 'max:', tutorialSteps.length - 1);
    return null;
  }

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      const newStep = stableStep + 1;
      if (newStep < tutorialSteps.length) {
        console.log('Going to next step:', newStep);
        onStepChange(newStep);
      }
    }
  };

  const handlePrevious = () => {
    if (stableStep > 0) {
      const newStep = stableStep - 1;
      console.log('Going to previous step:', newStep);
      onStepChange(newStep);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40 pointer-events-none" />

      {/* Highlight target element if specified */}
      {currentTutorialStep.target && (
        <div
          className="fixed z-45 pointer-events-none"
          style={{
            ...getTargetPosition(currentTutorialStep.target),
            boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.5), 0 0 0 8px rgba(99, 102, 241, 0.2)',
            borderRadius: '8px'
          }}
        />
      )}

      {/* Tutorial Card */}
      <div className="fixed z-50 pointer-events-auto" style={getCardPosition(currentTutorialStep)}>
        <Card className="w-96 max-w-[90vw] bg-slate-800/95 backdrop-blur-sm border-slate-600 shadow-2xl">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Play className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {currentTutorialStep.title}
                  </h3>
                  <div className="text-sm text-slate-400">
                    Step {stableStep + 1} of {tutorialSteps.length}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-slate-400 hover:text-white hover:bg-slate-700/50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-slate-300 mb-6 leading-relaxed">
              {currentTutorialStep.description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    className="bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700/70 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                >
                  <SkipForward className="w-4 h-4 mr-1" />
                  Skip Tour
                </Button>
                <Button
                  onClick={handleNext}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                >
                  {isLastStep ? 'Start Playing!' : 'Next'}
                  {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 w-full bg-slate-700 rounded-full h-1">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-1 rounded-full transition-all duration-300"
                style={{ width: `${tutorialSteps.length > 0 ? ((stableStep + 1) / tutorialSteps.length) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Helper function to get target element position for highlighting
function getTargetPosition(selector: string) {
  // Safety check - if selector is undefined or empty, return empty object
  if (!selector) {
    return {};
  }

  try {
    const element = document.querySelector(selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8
      };
    }
  } catch (error) {
    console.warn('Could not find tutorial target element:', selector);
  }
  return {};
}

// Helper function to position the tutorial card
function getCardPosition(step: TutorialStep) {
  // Safety check - if step is undefined, return center position
  if (!step) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  const basePosition = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  if (step.position === 'center') {
    return basePosition;
  }

  if (step.target) {
    try {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        switch (step.position) {
          case 'top':
            return {
              top: Math.max(20, rect.top - 120),
              left: Math.min(Math.max(20, rect.left + rect.width / 2 - 192), viewportWidth - 384),
              transform: 'none'
            };
          case 'bottom':
            return {
              top: Math.min(viewportHeight - 200, rect.bottom + 20),
              left: Math.min(Math.max(20, rect.left + rect.width / 2 - 192), viewportWidth - 384),
              transform: 'none'
            };
          case 'left':
            return {
              top: rect.top + rect.height / 2 - 100,
              left: Math.max(20, rect.left - 400),
              transform: 'none'
            };
          case 'right':
            return {
              top: rect.top + rect.height / 2 - 100,
              left: Math.min(viewportWidth - 420, rect.right + 20),
              transform: 'none'
            };
          default:
            return basePosition;
        }
      }
    } catch (error) {
      console.warn('Could not position tutorial card:', error);
    }
  }

  return basePosition;
}
