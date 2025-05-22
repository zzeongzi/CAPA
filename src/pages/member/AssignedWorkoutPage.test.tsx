import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AssignedWorkoutPage from './AssignedWorkoutPage';
import { AuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Toaster } from "@/components/ui/toaster";

// Mocks
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
    update: vi.fn().mockReturnThis(), // For set completion
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const mockAuthContextValue = {
  user: { id: 'test-member-id' },
  // Add other necessary mock properties from AuthContextType
  userCenter: 'test-center-id', 
  session: {}, 
  isLoading: false, 
  userRole: 'member', 
  setUserRole: vi.fn(), 
  setUserCenter: vi.fn(),
  refreshSession: vi.fn(),
};

const mockWorkoutSessionId = 'session-123';

const mockWorkoutSessionData = {
  id: mockWorkoutSessionId,
  session_date: new Date().toISOString(),
  notes: 'Test session notes',
  source_template_id: 'template-abc',
  workout_templates: { name: 'Full Body Blast' },
  users: { full_name: 'Test Trainer', avatar_url: null },
  workout_exercises: [
    {
      id: 'wex-1',
      order: 1,
      notes: 'Exercise 1 notes',
      exercise_id: 'ex-1',
      exercises: { name: 'Push Ups' },
      workout_sets: [
        { id: 'set-1a', set_number: 1, reps: 10, weight: null, completed: false, notes: null },
        { id: 'set-1b', set_number: 2, reps: 8, weight: null, completed: false, notes: null },
      ],
    },
    {
      id: 'wex-2',
      order: 2,
      notes: 'Exercise 2 notes',
      exercise_id: 'ex-2',
      exercises: { name: 'Squats' },
      workout_sets: [
        { id: 'set-2a', set_number: 1, reps: 12, weight: 50, completed: false, notes: null },
      ],
    },
  ],
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuthContextValue as any}>
        <MemoryRouter initialEntries={[`/member/workout/${mockWorkoutSessionId}`]}>
          <Routes>
            <Route path="/member/workout/:workoutSessionId" element={ui} />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe('AssignedWorkoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    (supabase.from('workout_sessions').select().eq().order().order().single as jest.Mock).mockResolvedValue({ data: mockWorkoutSessionData, error: null });
    (supabase.from('workout_sets').update as jest.Mock).mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) } as any);

  });

  it('renders loading state initially', () => {
    (supabase.from('workout_sessions').select().eq().order().order().single as jest.Mock).mockImplementationOnce(() => new Promise(() => {})); // Keep promise pending
    renderWithProviders(<AssignedWorkoutPage />);
    expect(screen.getByText(/운동 세션 로딩 중/i)).toBeInTheDocument();
  });

  it('displays workout session details correctly after loading', async () => {
    renderWithProviders(<AssignedWorkoutPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Push Ups/i)).toBeInTheDocument();
      expect(screen.getByText(/Exercise 1 notes/i)).toBeInTheDocument();
      expect(screen.getByText(/Squats/i)).toBeInTheDocument();
      expect(screen.getByText(/Test session notes/i)).toBeInTheDocument();
      expect(screen.getByText(/템플릿: Full Body Blast/i)).toBeInTheDocument();
      expect(screen.getByText(/담당 트레이너: Test Trainer/i)).toBeInTheDocument();

      // Check for sets
      expect(screen.getByText(/1세트/i)).toBeInTheDocument(); // For Push Ups
      expect(screen.getByText(/- \/ 10회/i)).toBeInTheDocument(); // Push ups set 1 (weight null)
      expect(screen.getByText(/- \/ 8회/i)).toBeInTheDocument();  // Push ups set 2 (weight null)
      expect(screen.getByText(/50kg \/ 12회/i)).toBeInTheDocument(); // Squats set 1
    });
  });

  it('shows error message if fetching session details fails', async () => {
    (supabase.from('workout_sessions').select().eq().order().order().single as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch session'));
    renderWithProviders(<AssignedWorkoutPage />);
    await waitFor(() => {
      expect(screen.getByText(/오류: Failed to fetch session/i)).toBeInTheDocument();
    });
  });

  it('shows "session not found" message if no session data is returned', async () => {
    (supabase.from('workout_sessions').select().eq().order().order().single as jest.Mock).mockResolvedValueOnce({ data: null, error: null });
    renderWithProviders(<AssignedWorkoutPage />);
    await waitFor(() => {
      expect(screen.getByText(/해당 운동 세션을 찾을 수 없습니다./i)).toBeInTheDocument();
    });
  });

  it('toggles set completion status on click and calls Supabase update', async () => {
    renderWithProviders(<AssignedWorkoutPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Push Ups/i)).toBeInTheDocument();
    });

    // Find the first set's completion toggle button (for Push Ups, set 1)
    // The buttons are identified by their visual content (Square or CheckSquare icon)
    // Let's find all Square icons (incomplete sets)
    const incompleteSetButtons = screen.getAllByRole('button', { name: /Square icon/i }); // Assuming lucide icons add accessible names or aria-labels
    expect(incompleteSetButtons.length).toBeGreaterThan(0);
    
    const firstSetToggleButton = incompleteSetButtons[0];

    // Initial state: not completed (Square icon)
    expect(firstSetToggleButton.querySelector('svg[data-lucide="square"]')).toBeInTheDocument();

    // Mock the update call
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    (supabase.from('workout_sets').update as jest.Mock).mockReturnValue({ eq: mockUpdateEq });

    // Click to complete
    await act(async () => {
      fireEvent.click(firstSetToggleButton);
    });
    
    await waitFor(() => {
      expect(mockUpdateEq).toHaveBeenCalledWith('id', 'set-1a'); // set-1a is the ID of the first set
      expect(supabase.from('workout_sets').update).toHaveBeenCalledWith(
        expect.objectContaining({ completed: true })
      );
      // Check for toast message
      expect(screen.getByText(/세트가 완료(으)로 표시되었습니다./i)).toBeInTheDocument();
      // UI should update to show CheckSquare icon (or a change in background)
      // Since the actual icon swap happens due to state change and re-render,
      // we might need to ensure the state update reflected in the DOM.
      // For now, checking the DB call and toast is primary.
      // After optimistic update, the icon should change.
      expect(firstSetToggleButton.querySelector('svg[data-lucide="check-square"]')).toBeInTheDocument();
    });

    // Click again to un-complete
    await act(async () => {
      fireEvent.click(firstSetToggleButton);
    });

    await waitFor(() => {
      expect(mockUpdateEq).toHaveBeenCalledWith('id', 'set-1a');
      expect(supabase.from('workout_sets').update).toHaveBeenCalledWith(
        expect.objectContaining({ completed: false })
      );
      expect(screen.getByText(/세트가 미완료(으)로 표시되었습니다./i)).toBeInTheDocument();
      expect(firstSetToggleButton.querySelector('svg[data-lucide="square"]')).toBeInTheDocument();
    });
  });
});
