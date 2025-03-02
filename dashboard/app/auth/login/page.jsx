'use client';

import { useState } from 'react';
import { useAuth } from '../../../components/auth-provider';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [telegramId, setTelegramId] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!telegramId || !authCode) {
      setError('Please enter both Telegram ID and authentication code');
      return;
    }

    try {
      const success = await login(telegramId, authCode);
      if (!success) {
        setError('Invalid credentials. Please try again.');
      }
    } catch (error) {
      setError('Authentication failed. Please try again later.');
      console.error('Login error:', error);
    }
  };

  return (
    <div className='min-h-screen flex flex-col items-center justify-center p-4'>
      {/* Logo and Header */}
      <div className='mb-8 text-center'>
        <h1 className='text-4xl font-bold neon-text mb-2'>COSMOVISION</h1>
        <p className='text-xl neon-blue-text'>TRADING DASHBOARD</p>
      </div>

      {/* Login Card */}
      <div className='cyber-card w-full max-w-md'>
        <h2 className='text-2xl font-bold text-center mb-6 neon-text'>ACCESS PORTAL</h2>

        {error && (
          <div className='bg-destructive/10 border border-destructive text-destructive p-3 mb-6'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='space-y-2'>
            <label htmlFor='telegramId' className='block font-mono text-sm text-foreground/70'>
              TELEGRAM ID
            </label>
            <input
              id='telegramId'
              type='text'
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              className='cyber-input w-full'
              placeholder='Enter your Telegram ID'
              disabled={loading}
            />
          </div>

          <div className='space-y-2'>
            <label htmlFor='authCode' className='block font-mono text-sm text-foreground/70'>
              AUTH CODE
            </label>
            <input
              id='authCode'
              type='password'
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              className='cyber-input w-full'
              placeholder='Enter the auth code from the bot'
              disabled={loading}
            />
          </div>

          <div className='pt-2'>
            <button type='submit' className='cyber-button w-full' disabled={loading}>
              {loading ? 'AUTHENTICATING...' : 'LOGIN'}
            </button>
          </div>
        </form>

        <div className='mt-8 text-center text-sm'>
          <p className='text-foreground/70'>
            Don't have an auth code?{' '}
            <a
              href='https://t.me/CosmoVision_Bot'
              target='_blank'
              rel='noopener noreferrer'
              className='text-neon-blue hover:text-neon-pink transition-colors'>
              Get one from the bot
            </a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className='mt-8 text-center text-xs text-foreground/50'>
        <p>Powered by: Lagrimas de zurdo</p>
      </div>
    </div>
  );
}
