'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!code || code.length < 6) {
      setError('Please enter a valid verification code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Post to the auth endpoint
      const response = await fetch('/api/tradingDashboard/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verify',
          code,
        }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        // Set the token in the API client
        api.setToken(data.token);
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        setError(data.error || 'Authentication failed. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex flex-col items-center justify-center p-4'>
      <div className='w-full max-w-md'>
        <div className='cyber-card'>
          <div className='mb-6 text-center'>
            <h1 className='text-3xl font-bold neon-text'>COSMOVISION</h1>
            <p className='text-xl mt-2'>Trading Dashboard</p>
          </div>

          {error && (
            <div className='mb-6 p-3 bg-destructive/10 border border-destructive text-destructive'>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className='mb-6'>
              <label className='block font-mono text-sm text-foreground/70 mb-2'>
                VERIFICATION CODE
              </label>
              <p className='text-sm text-foreground/60 mb-2'>
                Enter the verification code provided by the Telegram Bot. Use{' '}
                <code>/dashboard</code> command in Telegram to get a code.
              </p>
              <input
                type='text'
                className='cyber-input w-full'
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder='Enter 6-digit code'
                maxLength={6}
                minLength={6}
                pattern='[0-9]{6}'
                disabled={isLoading}
              />
            </div>

            <button type='submit' className='cyber-button w-full' disabled={isLoading}>
              {isLoading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'}
            </button>
          </form>

          <div className='mt-6 text-center text-foreground/50 text-sm'>
            <p>To obtain an access code, use the /dashboard command in the Telegram bot.</p>
          </div>
        </div>

        <div className='mt-8 text-center'>
          <p className='text-foreground/30 text-xs'>LAGRIMAS DE ZURDO 😎</p>
        </div>
      </div>
    </div>
  );
}
