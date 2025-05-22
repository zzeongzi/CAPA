import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreateEditWorkoutTemplatePage from './CreateEditWorkoutTemplatePage';
import { AuthContext } from '@/contexts/AuthContext'; // Assuming AuthContext is exported for provider value
import { supabase } from '@/integrations/supabase/client';
import { Toaster } from "@/components/ui/toaster"; // For toast messages

// Mocks
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }), // Default for fetching template
          order: vi.fn(() => ({ // For fetching template with exercises
             single: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        order: vi.fn(() => ({ // For fetchAllExercises
            mockResolvedValue: ({ data: [], error: null}), // Default for all exercises
        })),
      })),
      update: vi.fn(() => ({ // For upsert
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'new-template-id', name: 'Test Template' }, error: null }),
          })),
        })),
      })),
      insert: vi.fn(() => ({ // For upsert
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-template-id', name: 'Test Template' }, error: null }),
        })),
      })),
      delete: vi.fn(() => ({ // For deleting old exercises
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // Disable retries for tests
    },
  },
});

const mockAuthContextValue = {
  user: { id: 'test-user-id' },
  userCenter: 'test-center-id', // Make sure this matches expected type if it's an object
  // Add other properties from AuthContextType as needed, possibly mocked
  session: {}, 
  isLoading: false, 
  userRole: 'trainer', 
  setUserRole: vi.fn(), 
  setUserCenter: vi.fn(),
  refreshSession: vi.fn(),
};


const renderWithProviders = (ui: React.ReactElement, { route = '/', initialEntries = [route] } = {}) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuthContextValue as any}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path={route} element={ui} />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};


describe('CreateEditWorkoutTemplatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear(); // Clear query cache before each test

    // Reset mocks for supabase calls to default good responses
    (supabase.from('exercises').select().order as jest.Mock).mockResolvedValue({ data: [{id: 'ex1', name: 'Push Up'}, {id: 'ex2', name: 'Squat'}], error: null });
    (supabase.from('workout_templates').select().eq().single as jest.Mock).mockResolvedValue({ data: null, error: null });
     // For fetching template with exercises
    const mockOrderSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockOrder = vi.fn(() => ({ single: mockOrderSingle }));
    (supabase.from('workout_templates').select().eq().order as jest.Mock).mockReturnValue(mockOrder);


    (supabase.from('workout_templates').insert().select().single as jest.Mock).mockResolvedValue({ 
        data: { id: 'new-template-id', name: 'Test Template' }, error: null 
    });
    (supabase.from('workout_template_exercises').insert as jest.Mock).mockResolvedValue({ error: null });

  });

  it('renders create mode correctly', () => {
    renderWithProviders(<CreateEditWorkoutTemplatePage />, { route: '/trainer/templates/new' });
    expect(screen.getByText(/새 워크아웃 템플릿 만들기/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/템플릿 이름/i)).toBeInTheDocument();
    expect(screen.getByText(/템플릿 생성/i)).toBeInTheDocument();
  });

  it('validates form fields - name is required', async () => {
    renderWithProviders(<CreateEditWorkoutTemplatePage />, { route: '/trainer/templates/new' });
    
    fireEvent.click(screen.getByText(/템플릿 생성/i));

    await waitFor(() => {
      expect(screen.getByText(/템플릿 이름은 필수입니다./i)).toBeInTheDocument();
    });
  });

  it('allows submitting a new template with valid data', async () => {
    renderWithProviders(<CreateEditWorkoutTemplatePage />, { route: '/trainer/templates/new' });

    fireEvent.input(screen.getByLabelText(/템플릿 이름/i), { target: { value: 'My New Template' } });
    fireEvent.input(screen.getByLabelText(/설명/i), { target: { value: 'A great template.' } });
    
    await act(async () => {
      fireEvent.click(screen.getByText(/템플릿 생성/i));
    });

    await waitFor(() => {
      expect(supabase.from('workout_templates').insert).toHaveBeenCalled();
      expect(screen.queryByText(/템플릿 이름은 필수입니다./i)).not.toBeInTheDocument();
      // Check for success toast (actual toast rendering might need specific setup)
    });
  });
  
  it('loads existing template data in edit mode', async () => {
    const mockTemplate = {
      id: 'edit-template-id',
      name: 'Existing Template',
      description: 'Existing description',
      trainer_id: 'test-user-id',
      center_id: 'test-center-id',
      workout_template_exercises: [
        { id: 'wtex1', exercise_id: 'ex1', sets: 3, reps: '10', rest_period_seconds: 60, notes: 'notes1', exercise_order: 1 }
      ]
    };
    // Mock the specific fetch for edit mode
    const mockOrderSingle = vi.fn().mockResolvedValue({ data: mockTemplate, error: null });
    const mockOrder = vi.fn(() => ({ single: mockOrderSingle }));
    (supabase.from('workout_templates').select().eq().order as jest.Mock).mockReturnValue(mockOrder);


    renderWithProviders(<CreateEditWorkoutTemplatePage />, { route: '/trainer/templates/edit/:templateId', initialEntries: ['/trainer/templates/edit/edit-template-id'] });
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Template')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
      // Check if exercise is rendered (e.g., by checking for its name or a field)
      expect(screen.getByText('Push Up')).toBeInTheDocument(); // Assuming ex1 is Push Up
    });
  });

  it('allows adding an exercise to the list', async () => {
    renderWithProviders(<CreateEditWorkoutTemplatePage />, { route: '/trainer/templates/new' });

    // Open the modal
    fireEvent.click(screen.getByText(/운동 선택하여 추가/i));
    
    // Select an exercise (assuming 'Push Up' is an option from the mocked fetchAllExercises)
    // This part needs the modal to be interactive in the test environment.
    // For simplicity, we'll directly call append as if an exercise was selected.
    // A more robust test would interact with the modal elements.
    await act(async () => {
        // Simulate selecting "Push Up" (id: ex1) from modal and clicking "선택한 운동 추가"
        // This requires the modal to be part of the rendered output and interactive.
        // If modal interaction is too complex for this test, directly manipulate form state or useFieldArray's append
        // For now, let's assume the modal works and we click the add button that calls append.
        // We need to ensure `allExercises` is populated for the modal to work.
        await screen.findByText('Push Up'); // Wait for exercises to load in modal
        fireEvent.click(screen.getByText('Push Up')); // Select it
        fireEvent.click(screen.getByText('선택한 운동 추가')); // Click add in modal
    });

    await waitFor(() => {
      // Check if the added exercise is now part of the form fields
      // (e.g., a new set of input fields for the exercise appears)
      expect(screen.getAllByLabelText(/운동 선택/i).length).toBeGreaterThanOrEqual(1);
      // Check if the selected exercise is displayed
      expect(screen.getByText('Push Up', { exact: false })).toBeInTheDocument();
    });
  });


  it('allows removing an exercise from the list', async () => {
     renderWithProviders(<CreateEditWorkoutTemplatePage />, { route: '/trainer/templates/new' });

    // Add an exercise first
    await act(async () => {
        fireEvent.click(screen.getByText(/운동 선택하여 추가/i)); // Open modal
        await screen.findByText('Push Up'); 
        fireEvent.click(screen.getByText('Push Up')); 
        fireEvent.click(screen.getByText('선택한 운동 추가')); // Add in modal
    });
    
    await waitFor(() => {
        expect(screen.getByText('Push Up', { exact: false })).toBeInTheDocument();
    });

    // Click the remove button for the first exercise
    // The remove button is generic, so we select the first one.
    const removeButtons = screen.getAllByRole('button', { name: /Trash2 icon/i }); // Assuming icon implies name
    expect(removeButtons.length).toBeGreaterThan(0);
    fireEvent.click(removeButtons[0]);
    
    await waitFor(() => {
      // Check if the exercise is removed
      expect(screen.queryByText('Push Up', { exact: false })).not.toBeInTheDocument();
    });
  });

  it('submits updated template data including exercises', async () => {
    const mockTemplate = {
      id: 'edit-template-id-2',
      name: 'Template To Update',
      description: 'Initial desc',
      trainer_id: 'test-user-id',
      center_id: 'test-center-id',
      workout_template_exercises: []
    };
    const mockOrderSingle = vi.fn().mockResolvedValue({ data: mockTemplate, error: null });
    const mockOrder = vi.fn(() => ({ single: mockOrderSingle }));
    (supabase.from('workout_templates').select().eq().order as jest.Mock).mockReturnValue(mockOrder);

    // Mock update successful
     (supabase.from('workout_templates').update().eq().select().single as jest.Mock).mockResolvedValue({ 
        data: { ...mockTemplate, name: 'Updated Template Name' }, error: null 
    });


    renderWithProviders(<CreateEditWorkoutTemplatePage />, { route: '/trainer/templates/edit/:templateId', initialEntries: [`/trainer/templates/edit/${mockTemplate.id}`] });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Template To Update')).toBeInTheDocument();
    });

    // Change name
    fireEvent.input(screen.getByDisplayValue('Template To Update'), { target: { value: 'Updated Template Name' } });

    // Add an exercise
    await act(async () => {
      fireEvent.click(screen.getByText(/운동 선택하여 추가/i));
      await screen.findByText('Squat'); // ex2
      fireEvent.click(screen.getByText('Squat'));
      fireEvent.click(screen.getByText('선택한 운동 추가'));
    });
     await waitFor(() => {
        expect(screen.getByText('Squat', { exact: false })).toBeInTheDocument();
    });
    
    // Submit
    await act(async () => {
      fireEvent.click(screen.getByText(/템플릿 저장/i));
    });

    await waitFor(() => {
      expect(supabase.from('workout_templates').update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Template Name' })
      );
      expect(supabase.from('workout_template_exercises').delete).toHaveBeenCalledWith(); // Called with .eq('template_id', mockTemplate.id)
      expect(supabase.from('workout_template_exercises').insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ exercise_id: 'ex2' }) // Assuming 'Squat' is ex2
        ])
      );
    });
  });

});
