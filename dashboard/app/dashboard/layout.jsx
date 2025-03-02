'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/auth-provider';
import DashboardNav from '../../components/dashboard-nav';

export default function DashboardLayout({ children }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated and not loading
    if (!loading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [loading, isAuthenticated, router]);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='cyber-card animate-pulse'>
          <h2 className='neon-text text-xl'>VERIFYING CREDENTIALS...</h2>
        </div>
      </div>
    );
  }

  // Show dashboard only if authenticated
  if (isAuthenticated) {
    return (
      <div className='min-h-screen flex flex-col'>
        <DashboardNav />

        <main className='flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full'>{children}</main>

        <footer className='py-4 px-6 text-center border-t border-foreground/10'>
          <p className='text-foreground/50 text-sm'>
            CosmoVision Trading Dashboard • Lagrimas de zurdo 😎
          </p>
        </footer>
      </div>
    );
  }

  // This shouldn't render, but as a fallback
  return null;
}
