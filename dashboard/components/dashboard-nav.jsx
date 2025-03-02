'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth-provider';

/**
 * Dashboard navigation component with cyberpunk design
 */
export default function DashboardNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    { name: 'Overview', path: '/dashboard' },
    { name: 'Trading Signals', path: '/dashboard/signals' },
    { name: 'My Trades', path: '/dashboard/trades' },
    { name: 'Performance', path: '/dashboard/performance' },
    { name: 'Settings', path: '/dashboard/settings' },
  ];

  return (
    <nav className='cyber-nav sticky top-0 z-10'>
      <div className='flex items-center justify-between'>
        {/* Logo */}
        <Link href='/dashboard' className='flex items-center'>
          <h1 className='text-2xl font-bold neon-text'>COSMOVISION</h1>
        </Link>

        {/* Navigation Items */}
        <div className='hidden md:flex items-center space-x-8'>
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`cyber-nav-item ${
                pathname === item.path ? 'text-neon-pink' : 'text-foreground/70'
              }`}>
              {item.name}
            </Link>
          ))}
        </div>

        {/* User Menu */}
        <div className='flex items-center'>
          {user && (
            <div className='flex items-center gap-4'>
              <span className='hidden md:inline text-sm text-foreground/70'>
                @{user.username || 'User'}
              </span>
              <button
                onClick={logout}
                className='border border-neon-pink text-neon-pink px-2 py-1 text-sm hover:bg-neon-pink/10 transition-colors'>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className='mt-4 md:hidden grid grid-cols-2 gap-2'>
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`text-center px-2 py-1 text-sm ${
              pathname === item.path
                ? 'border border-neon-pink text-neon-pink'
                : 'border border-foreground/20 text-foreground/70'
            }`}>
            {item.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
