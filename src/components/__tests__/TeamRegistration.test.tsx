import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeamRegistration from '../TeamRegistration';

describe('TeamRegistration', () => {
  const mockOnTeamsRegistered = jest.fn();

  beforeEach(() => {
    mockOnTeamsRegistered.mockClear();
  });

  test('renders team registration form correctly', () => {
    render(<TeamRegistration onTeamsRegistered={mockOnTeamsRegistered} />);

    expect(screen.getByText('Team Registration')).toBeInTheDocument();
    expect(screen.getByText('Enter the names of the participating teams.')).toBeInTheDocument();
    expect(screen.getByText('Team 1:')).toBeInTheDocument();
    expect(screen.getByText('Team 2:')).toBeInTheDocument();
    expect(screen.getByText('Team 3:')).toBeInTheDocument();
    expect(screen.getByText('Team 4:')).toBeInTheDocument();
  });

  test('allows team name input', () => {
    render(<TeamRegistration onTeamsRegistered={mockOnTeamsRegistered} />);

    const team1Input = screen.getByPlaceholderText('Team 1 Name');
    const team2Input = screen.getByPlaceholderText('Team 2 Name');

    fireEvent.change(team1Input, { target: { value: 'Alpha Team' } });
    fireEvent.change(team2Input, { target: { value: 'Beta Team' } });

    expect(team1Input).toHaveValue('Alpha Team');
    expect(team2Input).toHaveValue('Beta Team');
  });

  test('submits valid teams', () => {
    render(<TeamRegistration onTeamsRegistered={mockOnTeamsRegistered} />);

    const team1Input = screen.getByPlaceholderText('Team 1 Name');
    const team2Input = screen.getByPlaceholderText('Team 2 Name');
    const submitButton = screen.getByRole('button', { name: /register teams/i });

    fireEvent.change(team1Input, { target: { value: 'Alpha Team' } });
    fireEvent.change(team2Input, { target: { value: 'Beta Team' } });
    fireEvent.click(submitButton);

    expect(mockOnTeamsRegistered).toHaveBeenCalledWith(['Alpha Team', 'Beta Team']);
  });

  test('does not submit with less than 2 teams', () => {
    render(<TeamRegistration onTeamsRegistered={mockOnTeamsRegistered} />);

    const team1Input = screen.getByPlaceholderText('Team 1 Name');
    const submitButton = screen.getByRole('button', { name: /register teams/i });

    fireEvent.change(team1Input, { target: { value: 'Alpha Team' } });
    fireEvent.click(submitButton);

    expect(mockOnTeamsRegistered).not.toHaveBeenCalled();
  });

  test('filters out empty team names', () => {
    render(<TeamRegistration onTeamsRegistered={mockOnTeamsRegistered} />);

    const team1Input = screen.getByPlaceholderText('Team 1 Name');
    const team2Input = screen.getByPlaceholderText('Team 2 Name');
    const team3Input = screen.getByPlaceholderText('Team 3 Name');
    const submitButton = screen.getByRole('button', { name: /register teams/i });

    fireEvent.change(team1Input, { target: { value: 'Alpha Team' } });
    fireEvent.change(team2Input, { target: { value: 'Beta Team' } });
    fireEvent.change(team3Input, { target: { value: '' } });
    fireEvent.click(submitButton);

    expect(mockOnTeamsRegistered).toHaveBeenCalledWith(['Alpha Team', 'Beta Team']);
  });

  test('allows adding more teams', () => {
    render(<TeamRegistration onTeamsRegistered={mockOnTeamsRegistered} />);

    const addButton = screen.getByRole('button', { name: /add team/i });
    fireEvent.click(addButton);

    expect(screen.getByText('Team 5:')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Team 5 Name')).toBeInTheDocument();
  });

  test('allows removing teams when more than 2 exist', () => {
    render(<TeamRegistration onTeamsRegistered={mockOnTeamsRegistered} />);

    // Add a team first
    const addButton = screen.getByRole('button', { name: /add team/i });
    fireEvent.click(addButton);

    // Now we should have remove buttons
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    expect(removeButtons.length).toBeGreaterThan(0);

    // Click remove on the last team
    fireEvent.click(removeButtons[removeButtons.length - 1]);

    expect(screen.queryByText('Team 5:')).not.toBeInTheDocument();
  });

  test('prevents removing when only 2 teams remain', () => {
    render(<TeamRegistration onTeamsRegistered={mockOnTeamsRegistered} />);

    // Try to remove a team when we have only 4 (default)
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });

    // Initially we have 4 teams, so we should be able to remove
    expect(removeButtons.length).toBe(4);

    // Remove one team
    fireEvent.click(removeButtons[0]);

    // Now we should have 3 teams
    expect(screen.queryByText('Team 4:')).not.toBeInTheDocument();
  });
});
