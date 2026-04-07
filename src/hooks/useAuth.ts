'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { User as NextAuthUser } from '@/types';

export function useAuth() {
  const { data: session, status } = useSession();
  
  const user: NextAuthUser | null = session?.user
    ? {
        uid: session.user.id,
        email: session.user.email || '',
        displayName: session.user.name || '',
        photoURL: session.user.image || '',
      }
    : null;

  return {
    user,
    loading: status === 'loading',
    login: () => signIn('google'),
    logout: () => signOut({ callbackUrl: '/login' }),
  };
}