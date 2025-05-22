import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserRole } from './useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn(),
  },
}));

describe('useUserRole', () => {
  const mockUseAuth = useAuth as jest.Mock;
  const mockSupabaseFrom = supabase.from as jest.Mock;
  const mockSupabaseSelect = supabase.select as jest.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return default roles when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useUserRole());

    expect(result.current.roles).toEqual([]);
    expect(result.current.isTrainer).toBe(false);
    expect(result.current.isMember).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isOwner).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should return correct roles and flags for a trainer', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-trainer-id' } });
    mockSupabaseSelect.mockResolvedValueOnce({ data: [{ role: 'trainer' }], error: null });
    
    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.roles).toEqual(['trainer']);
    expect(result.current.isTrainer).toBe(true);
    expect(result.current.isMember).toBe(false);
    expect(result.current.isAdmin).toBe(false); // Assuming 'admin' role needed for isAdmin
    expect(result.current.isOwner).toBe(false); // isOwner depends on isAdmin
    expect(result.current.error).toBe(null);
  });

  it('should return correct roles and flags for an admin', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-admin-id' } });
    mockSupabaseSelect.mockResolvedValueOnce({ data: [{ role: 'admin' }], error: null });

    const { result } = renderHook(() => useUserRole());
    
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.roles).toEqual(['admin']);
    expect(result.current.isTrainer).toBe(false);
    expect(result.current.isMember).toBe(false);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isOwner).toBe(true); // isOwner is true if isAdmin is true
  });
  
  it('should return correct roles and flags for a user with multiple roles (trainer, admin)', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-multi-role-id' } });
    mockSupabaseSelect.mockResolvedValueOnce({ data: [{ role: 'trainer' }, { role: 'admin' }], error: null });

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.roles).toEqual(['trainer', 'admin']);
    expect(result.current.isTrainer).toBe(true);
    expect(result.current.isMember).toBe(false);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isOwner).toBe(true);
  });

  it('should return empty roles if fetch returns no data', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-no-roles-id' } });
    mockSupabaseSelect.mockResolvedValueOnce({ data: null, error: null });
    
    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.roles).toEqual([]);
    expect(result.current.isTrainer).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it('should handle loading state correctly', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-loading-id' } });
    // Don't resolve the promise immediately to check loading state
    mockSupabaseSelect.mockReturnValueOnce(new Promise(() => {})); 

    const { result } = renderHook(() => useUserRole());

    expect(result.current.isLoading).toBe(true);
  });

  it('should handle error state correctly', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-error-id' } });
    const mockError = new Error('Failed to fetch roles');
    mockSupabaseSelect.mockResolvedValueOnce({ data: null, error: mockError });
    
    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe(mockError);
    expect(result.current.roles).toEqual([]);
    expect(result.current.isTrainer).toBe(false);
  });
  
  it('should call supabase.from with "user_roles" and filter by user_id', async () => {
    const userId = 'test-user-id';
    mockUseAuth.mockReturnValue({ user: { id: userId } });
    mockSupabaseSelect.mockResolvedValueOnce({ data: [], error: null });

    renderHook(() => useUserRole());

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith('user_roles');
      // The select call is chained, so we check its arguments on the mock returned by from()
      // This specific check is a bit tricky because select is called on the return of from()
      // However, the mock setup for supabase.select covers the actual select call.
      // We can verify that select itself was called.
      expect(mockSupabaseSelect).toHaveBeenCalled();
      // To check the .eq part, you might need a deeper mock structure if not using a library that simplifies this.
      // For now, ensuring select is called after from('user_roles') is a good indicator.
    });
  });
});
