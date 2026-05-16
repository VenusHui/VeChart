'use client';

import { createContext, ReactNode, startTransition, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { User } from '@/lib/types';

export const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
}>({
  user: null,
  loading: true,
  refresh: async () => undefined
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const profile = await api.currentUser();
      startTransition(() => {
        setUser(profile);
        setLoading(false);
      });
    } catch {
      startTransition(() => {
        setUser(null);
        setLoading(false);
      });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
