import '@/app/globals.css';

import type { Metadata } from 'next';

import { AuthProvider } from '@/components/auth-provider';
import { Shell } from '@/components/shell';

export const metadata: Metadata = {
  title: 'VeChart',
  description: 'Product cloud album and share document system'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
