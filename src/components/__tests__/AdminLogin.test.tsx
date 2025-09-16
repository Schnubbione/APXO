// React import not needed with new JSX transform
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminLogin } from '../AdminLogin';

// Mock the GameContext
jest.mock('../../contexts/GameContext', () => ({
  useGame: jest.fn()
}));

import { useGame } from '../../contexts/GameContext';

describe('AdminLogin', () => {
  const mockLoginAsAdmin = jest.fn();
  const mockUseGame = useGame as jest.MockedFunction<typeof useGame>;

  beforeEach(() => {
    mockLoginAsAdmin.mockClear();
    mockUseGame.mockReturnValue({
      socket: null,
      loginAsAdmin: mockLoginAsAdmin,
      isAdmin: false,
      gameState: {
        teams: [],
        currentRound: 0,
        totalRounds: 5,
        isActive: false,
        baseDemand: 100,
        spread: 50,
        shock: 0.1,
        sharedMarket: true,
        seed: 42,
        roundTime: 300,
        fares: [],
        currentPhase: 'prePurchase',
        phaseTime: 600,
        totalCapacity: 1000,
        totalFixSeats: 500,
        availableFixSeats: 500,
        fixSeatPrice: 60,
        simulationMonths: 12,
        departureDate: new Date(),
        poolingMarketUpdateInterval: 1,
        simulatedWeeksPerUpdate: 1,
        poolingMarket: {
          currentPrice: 150,
          totalPoolingCapacity: 300,
          availablePoolingCapacity: 300,
          offeredPoolingCapacity: 0,
          currentDemand: 100,
          lastUpdate: new Date().toISOString(),
          priceHistory: []
        }
      },
      currentTeam: null,
      roundResults: null,
      leaderboard: null,
      roundHistory: [],
      analyticsData: null,
      registrationError: null,
  tutorialActive: false,
      tutorialStep: 0,
      startTutorial: jest.fn(),
      skipTutorial: jest.fn(),
      nextTutorialStep: jest.fn(),
      previousTutorialStep: jest.fn(),
  setTutorialStep: jest.fn(),
  completeTutorial: jest.fn(),
  adminLoginError: null,
  logoutAsAdmin: jest.fn(),
      registerTeam: jest.fn(),
      updateGameSettings: jest.fn(),
      updateTeamDecision: jest.fn(),
      startPrePurchasePhase: jest.fn(),
      startSimulationPhase: jest.fn(),
      startRound: jest.fn(),
      endRound: jest.fn(),
      getLeaderboard: jest.fn(),
      getAnalytics: jest.fn(),
      resetAllData: jest.fn(),
      resetCurrentGame: jest.fn()
    });
  });

  test('renders admin login form correctly', () => {
    render(<AdminLogin />);

    expect(screen.getByText('Admin Login')).toBeInTheDocument();
    expect(screen.getByText(/enter admin password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter admin password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login as admin/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /back to team registration/i })).toBeInTheDocument();
  });

  test('allows password input', () => {
    render(<AdminLogin />);

    const passwordInput = screen.getByPlaceholderText('Enter admin password');
    fireEvent.change(passwordInput, { target: { value: 'admin123' } });

    expect(passwordInput).toHaveValue('admin123');
  });

  test('submits password when form is submitted', () => {
    render(<AdminLogin />);

    const passwordInput = screen.getByPlaceholderText('Enter admin password');
    const submitButton = screen.getByRole('button', { name: /login as admin/i });

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(submitButton);

    expect(mockLoginAsAdmin).toHaveBeenCalledWith('admin123');
  });

  test('submits password when Enter key is pressed', () => {
    render(<AdminLogin />);

    const passwordInput = screen.getByPlaceholderText('Enter admin password');

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.submit(passwordInput);

    expect(mockLoginAsAdmin).toHaveBeenCalledWith('admin123');
  });

  test('does not submit empty password', () => {
    render(<AdminLogin />);

    const submitButton = screen.getByRole('button', { name: /login as admin/i });
    fireEvent.click(submitButton);

    expect(mockLoginAsAdmin).not.toHaveBeenCalled();
  });

  test('trims whitespace from password', () => {
    render(<AdminLogin />);

    const passwordInput = screen.getByPlaceholderText('Enter admin password');
    const submitButton = screen.getByRole('button', { name: /login as admin/i });

    fireEvent.change(passwordInput, { target: { value: '  admin123  ' } });
    fireEvent.click(submitButton);

    expect(mockLoginAsAdmin).toHaveBeenCalledWith('admin123');
  });

  test('clears password after submission', () => {
    render(<AdminLogin />);

    const passwordInput = screen.getByPlaceholderText('Enter admin password');
    const submitButton = screen.getByRole('button', { name: /login as admin/i });

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(submitButton);

    expect(passwordInput).toHaveValue('');
  });

  test('shows loading state during submission', async () => {
    render(<AdminLogin />);

    const passwordInput = screen.getByPlaceholderText('Enter admin password');
    const submitButton = screen.getByRole('button', { name: /login as admin/i });

    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(submitButton);

    // Check loading state
    expect(screen.getByText('Logging in...')).toBeInTheDocument();
    expect(passwordInput).toBeDisabled();
    expect(submitButton).toBeDisabled();

    // Wait for loading to finish (2 seconds as per component)
    await waitFor(() => {
      expect(screen.queryByText('Logging in...')).not.toBeInTheDocument();
    }, { timeout: 2500 });
  });

  test('back button reloads the page', () => {
    // Mock window.location.reload
    const mockReload = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true
    });

    render(<AdminLogin />);

  const backButton = screen.getByRole('button', { name: /back to team registration/i });
    fireEvent.click(backButton);

    expect(mockReload).toHaveBeenCalled();
  });
});
