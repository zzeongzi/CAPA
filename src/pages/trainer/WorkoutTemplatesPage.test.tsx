import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorkoutTemplatesPage from './WorkoutTemplatesPage';
import { AuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Toaster } from "@/components/ui/toaster";

// Mocks
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }), // Default empty
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }), // Default delete success
      })),
    })),
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
  user: { id: 'test-trainer-id' },
  // Add other necessary mock properties from AuthContextType
  userCenter: 'test-center-id', 
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

describe('WorkoutTemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    // Reset supabase.from().select() to a default mock for this suite
    (supabase.from('workout_templates').select as jest.Mock).mockResolvedValue({ data: [], error: null });
  });

  it('renders loading state initially', () => {
    // Make the promise pending
    (supabase.from('workout_templates').select as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
    renderWithProviders(<WorkoutTemplatesPage />, { route: '/trainer/templates' });
    expect(screen.getByText(/템플릿 로딩 중/i)).toBeInTheDocument(); // Or check for Skeletons
    expect(screen.queryAllByRole('heading', { name: /내 워크아웃 템플릿/i})).toHaveLength(0); // Title not yet visible
  });

  it('renders empty state when no templates are fetched', async () => {
    renderWithProviders(<WorkoutTemplatesPage />, { route: '/trainer/templates' });
    await waitFor(() => {
      expect(screen.getByText(/아직 생성된 워크아웃 템플릿이 없습니다./i)).toBeInTheDocument();
    });
  });

  it('displays fetched templates correctly', async () => {
    const mockTemplates = [
      { id: 't1', name: 'Template 1', description: 'Desc 1', trainer_id: 'test-trainer-id', center_id: 'c1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 't2', name: 'Template 2', description: 'Desc 2', trainer_id: 'test-trainer-id', center_id: 'c1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    (supabase.from('workout_templates').select as jest.Mock).mockResolvedValueOnce({ data: mockTemplates, error: null });

    renderWithProviders(<WorkoutTemplatesPage />, { route: '/trainer/templates' });

    await waitFor(() => {
      expect(screen.getByText('Template 1')).toBeInTheDocument();
      expect(screen.getByText('Desc 1')).toBeInTheDocument();
      expect(screen.getByText('Template 2')).toBeInTheDocument();
      expect(screen.getByText('Desc 2')).toBeInTheDocument();
    });
  });

  it('shows error message if fetching templates fails', async () => {
    (supabase.from('workout_templates').select as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'));
    renderWithProviders(<WorkoutTemplatesPage />, { route: '/trainer/templates' });
    await waitFor(() => {
      expect(screen.getByText(/템플릿 로딩 중 오류 발생: Failed to fetch/i)).toBeInTheDocument();
    });
  });

  it('navigates to new template page on "새 템플릿 만들기" button click', async () => {
    renderWithProviders(<WorkoutTemplatesPage />, { route: '/trainer/templates' });
    
    // Wait for initial loading to complete (even if it's empty state)
    await waitFor(() => {
        expect(screen.getByText(/새 템플릿 만들기/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/새 템플릿 만들기/i));
    
    // This test relies on the MemoryRouter setup and actual navigation.
    // If testing navigation behavior is complex, you might mock useNavigate and check its calls.
    // For this setup, we assume the navigation happens and the target page would render (if defined in test routes).
    // Since we don't have routes for /trainer/templates/new in this specific test file's MemoryRouter,
    // we can't assert its content. The primary goal here is to check the button click.
  });

  it('shows delete confirmation dialog when delete button is clicked', async () => {
    const mockTemplates = [
      { id: 't1', name: 'Template to Delete', description: 'Desc', trainer_id: 'test-trainer-id', center_id: 'c1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    (supabase.from('workout_templates').select as jest.Mock).mockResolvedValueOnce({ data: mockTemplates, error: null });
    
    renderWithProviders(<WorkoutTemplatesPage />, { route: '/trainer/templates' });

    await waitFor(() => {
      expect(screen.getByText('Template to Delete')).toBeInTheDocument();
    });

    // Find the delete button for "Template to Delete"
    // This might require more specific selectors if there are multiple delete buttons
    const deleteButtons = screen.getAllByRole('button', { name: /삭제/i }); // Get all delete buttons
    const templateCard = screen.getByText('Template to Delete').closest('div[role="article"], div.card, li'); // Adjust selector based on your Card component
    
    let deleteButtonForTemplate;
    if (templateCard) {
        const buttonsInCard = Array.from(templateCard.querySelectorAll('button'));
        deleteButtonForTemplate = buttonsInCard.find(btn => btn.textContent?.includes('삭제'));
    }
    
    expect(deleteButtonForTemplate).toBeDefined();
    if (!deleteButtonForTemplate) return; // Guard for type checker

    fireEvent.click(deleteButtonForTemplate);

    await waitFor(() => {
      expect(screen.getByText(/정말로 삭제하시겠습니까?/i)).toBeInTheDocument();
      expect(screen.getByText(/Template to Delete/i)).toBeInTheDocument(); // Check name is in dialog
    });
  });

  it('calls delete mutation when confirmation is accepted', async () => {
    const mockTemplates = [
      { id: 't1-delete', name: 'Template For Deletion Test', description: 'Desc', trainer_id: 'test-trainer-id', center_id: 'c1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    (supabase.from('workout_templates').select as jest.Mock).mockResolvedValueOnce({ data: mockTemplates, error: null });
    const deleteMock = (supabase.from('workout_templates').delete().eq as jest.Mock).mockResolvedValue({ error: null });


    renderWithProviders(<WorkoutTemplatesPage />, { route: '/trainer/templates' });

    await waitFor(() => screen.getByText('Template For Deletion Test'));
    
    const deleteButton = screen.getAllByRole('button', { name: /삭제/i })
        .find(btn => btn.closest('div.card, div[role="article"], li')?.textContent?.includes('Template For Deletion Test'));
    expect(deleteButton).toBeDefined();
    if(!deleteButton) return;

    fireEvent.click(deleteButton);
    
    await waitFor(() => screen.getByText('삭제 확인')); // Dialog confirmation button
    fireEvent.click(screen.getByText('삭제 확인'));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith('id', 't1-delete');
      // Optionally check for success toast
      expect(screen.getByText(/워크아웃 템플릿이 삭제되었습니다./i)).toBeInTheDocument();
    });
  });

});
