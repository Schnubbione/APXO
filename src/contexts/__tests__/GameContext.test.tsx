import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock Socket.IO before importing GameContext
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    close: jest.fn(),
    id: 'test-socket-id'
  }))
}));

import { GameProvider, useGame } from '../../contexts/GameContext';

// Test component that uses the context
const TestComponent: React.FC = () => {
  const {
    gameState,
    currentTeam,
    isAdmin,
    tutorialActive,
    tutorialStep
  } = useGame();

  return (
    <div>
      <div data-testid="current-round">{gameState.currentRound}</div>
      <div data-testid="total-rounds">{gameState.totalRounds}</div>
      <div data-testid="is-active">{gameState.isActive.toString()}</div>
      <div data-testid="current-team">{currentTeam?.name || 'No team'}</div>
      <div data-testid="is-admin">{isAdmin.toString()}</div>
      <div data-testid="tutorial-active">{tutorialActive.toString()}</div>
      <div data-testid="tutorial-step">{tutorialStep}</div>
    </div>
  );
};

describe('GameContext', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('throws error when useGame is used outside provider', () => {
    // Mock console.error to avoid noise in test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestComponent />)).toThrow(
      'useGame must be used within a GameProvider'
    );

    consoleSpy.mockRestore();
  });

  test('provides initial game state correctly', async () => {
    const { unmount } = render(
      <GameProvider>
        <TestComponent />
      </GameProvider>
    );

    // Wait for component to render and context to initialize
    await waitFor(() => {
      expect(screen.getByTestId('current-round')).toHaveTextContent('0');
      expect(screen.getByTestId('total-rounds')).toHaveTextContent('5');
      expect(screen.getByTestId('is-active')).toHaveTextContent('false');
      expect(screen.getByTestId('current-team')).toHaveTextContent('No team');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
      expect(screen.getByTestId('tutorial-active')).toHaveTextContent('false');
      expect(screen.getByTestId('tutorial-step')).toHaveTextContent('0');
    });

    // Clean up without triggering socket close
    unmount();
  });

  test('initializes with correct default values', async () => {
    const { unmount } = render(
      <GameProvider>
        <TestComponent />
      </GameProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-round')).toHaveTextContent('0');
      expect(screen.getByTestId('total-rounds')).toHaveTextContent('5');
      expect(screen.getByTestId('is-active')).toHaveTextContent('false');
    });

    // Clean up without triggering socket close
    unmount();
  });
});
