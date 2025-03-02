'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/auth-provider';
import DashboardNav from '../../components/dashboard-nav';
import Image from 'next/image';

/**
 * Dashboard layout with authentication check
 */
export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Check authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  // Show loading state
  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='cyber-card animate-pulse'>
          <h2 className='neon-text text-2xl'>LOADING...</h2>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render content
  if (!user) {
    return null;
  }

  return (
    <div className='min-h-screen flex flex-col'>
      <DashboardNav />

      <main className='flex-1 container mx-auto py-8 px-4'>{children}</main>

      <footer className='py-6 px-4 border-t border-neon-pink/30 mt-auto'>
        <div className='container mx-auto flex flex-col md:flex-row justify-between items-center'>
          <div className='flex items-center gap-2 mb-4 md:mb-0'>
            <div className='neon-text text-sm'>COSMOVISION TRADING DASHBOARD</div>
          </div>

          <div className='text-xs text-foreground/50 flex items-center gap-2'>
            <span>Powered by: Lagrimas de zurdo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
