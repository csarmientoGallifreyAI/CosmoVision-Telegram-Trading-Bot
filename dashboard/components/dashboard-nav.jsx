'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth-provider';

export default function DashboardNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const navItems = [
    { name: 'Overview', href: '/dashboard' },
    { name: 'Signals', href: '/dashboard/signals' },
    { name: 'Trades', href: '/dashboard/trades' },
    { name: 'Performance', href: '/dashboard/performance' },
    { name: 'Settings', href: '/dashboard/settings' },
  ];

  const isActive = (path) => {
    if (path === '/dashboard' && pathname === '/dashboard') {
      return true;
    }
    return pathname.startsWith(path) && path !== '/dashboard';
  };

  return (
    <nav className='border-b border-foreground/10 bg-background/80 backdrop-blur-md sticky top-0 z-10'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between h-16'>
          <div className='flex items-center'>
            <Link href='/dashboard' className='flex-shrink-0 flex items-center'>
              <span className='text-xl font-bold neon-text'>COSMOVISION</span>
            </Link>
          </div>

          {/* Desktop nav */}
          <div className='hidden md:flex md:items-center md:space-x-4'>
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`px-3 py-2 text-sm font-medium ${
                  isActive(item.href)
                    ? 'neon-text border-b border-neon-blue'
                    : 'text-foreground/70 hover:text-foreground'
                }`}>
                {item.name.toUpperCase()}
              </Link>
            ))}
            <button onClick={logout} className='ml-4 cyber-button-sm'>
              LOGOUT
            </button>
          </div>

          {/* Mobile menu button */}
          <div className='flex items-center md:hidden'>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className='inline-flex items-center justify-center p-2 rounded-md text-foreground/70 hover:text-foreground'>
              <span className='sr-only'>Open main menu</span>
              {mobileMenuOpen ? (
                <svg
                  className='block h-6 w-6'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              ) : (
                <svg
                  className='block h-6 w-6'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M4 6h16M4 12h16M4 18h16'
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className='md:hidden border-t border-foreground/10'>
          <div className='px-2 pt-2 pb-3 space-y-1'>
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-3 py-2 text-base font-medium ${
                  isActive(item.href) ? 'neon-text' : 'text-foreground/70 hover:text-foreground'
                }`}
                onClick={() => setMobileMenuOpen(false)}>
                {item.name.toUpperCase()}
              </Link>
            ))}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className='mt-4 w-full cyber-button-sm'>
              LOGOUT
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
