'use client';

import Link from 'next/link';
import { useContext, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { AuthContext } from './auth-provider';
import { api } from '@/lib/api';

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, refresh } = useContext(AuthContext);
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = pathname === '/login';

  useEffect(() => {
    if (!loading && !isAuthRoute && !user) {
      router.replace('/login');
    }
  }, [isAuthRoute, loading, pathname, router, user]);

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          VeChart
        </Link>
        <div className="topbar-actions">
          {user ? (
            <>
              <span className="user-chip">
                {user.name} · {user.role}
              </span>
              <button
                className="button button-secondary"
                onClick={async () => {
                  await api.logout();
                  await refresh();
                  window.location.href = '/login';
                }}
              >
                退出
              </button>
            </>
          ) : (
            <Link href="/login" className="button button-secondary">
              登录
            </Link>
          )}
        </div>
      </header>
      <main className="page">
        {loading && !isAuthRoute ? (
          <div className="panel">加载登录态...</div>
        ) : isAuthRoute || user ? (
          children
        ) : (
          <div className="panel">正在跳转登录...</div>
        )}
      </main>
    </div>
  );
}
