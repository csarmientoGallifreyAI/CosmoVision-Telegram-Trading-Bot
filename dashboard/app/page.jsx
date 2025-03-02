'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    if (api.isAuthenticated()) {
      // If authenticated, redirect to dashboard
      router.push('/dashboard');
    } else {
      // If not authenticated, redirect to login
      router.push('/auth/login');
    }
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className='min-h-screen flex items-center justify-center bg-background'>
      <div className='cyber-card animate-pulse'>
        <h1 className='text-2xl font-bold neon-text mb-4'>INITIALIZING SYSTEM</h1>
        <p className='text-foreground/70'>Loading CosmoVision Trading Interface...</p>
      </div>
    </div>
  );
}
