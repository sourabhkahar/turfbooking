'use client';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth as useAuthContext } from '@/context/AuthContext';

/**
 * Re-exports the AuthContext hook and adds role-based navigation helpers.
 *
 * @example
 * const { user, isOwner, redirectByRole } = useAuth();
 */
export function useAuth() {
  const auth = useAuthContext();
  const router = useRouter();

  const isAdmin = auth.user?.role === 'super_admin';
  const isOwner = auth.user?.role === 'owner' || isAdmin;
  const isUser = !!auth.user;

  /** After login, send the user to their role-appropriate dashboard. */
  const redirectByRole = useCallback((role?: string) => {
    const r = role ?? auth.user?.role;
    if (r === 'super_admin') router.push('/admin');
    else if (r === 'owner') router.push('/owner');
    else router.push('/customer');
  }, [auth.user?.role, router]);

  /** Guard: redirect to /login if not authenticated. */
  const requireAuth = useCallback(() => {
    if (!auth.loading && !auth.user) {
      router.push('/login');
      return false;
    }
    return true;
  }, [auth.loading, auth.user, router]);

  /** Guard: redirect away if the user doesn't have the required role. */
  const requireRole = useCallback((role: 'super_admin' | 'owner' | 'user') => {
    if (!auth.user) { router.push('/login'); return false; }
    if (role === 'super_admin' && auth.user.role !== 'super_admin') { router.push('/'); return false; }
    if (role === 'owner' && !isOwner) { router.push('/'); return false; }
    return true;
  }, [auth.user, isOwner, router]);

  return { ...auth, isAdmin, isOwner, isUser, redirectByRole, requireAuth, requireRole };
}

