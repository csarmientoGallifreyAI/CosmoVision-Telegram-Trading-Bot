'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import Link from 'next/link';
import Image from 'next/image';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        const data = await api.getDashboardSummary();
        setSummary(data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className='cyber-card animate-pulse'>
        <h2 className='neon-text text-xl'>LOADING DASHBOARD DATA...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className='cyber-card border-destructive'>
        <h2 className='text-destructive text-xl mb-4'>System Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className='cyber-button mt-4'>
          RETRY
        </button>
      </div>
    );
  }

  return (
    <div className='space-y-8'>
      <header>
        <h1 className='text-3xl font-bold neon-text mb-2'>TRADING DASHBOARD</h1>
        <p className='text-foreground/70'>
          Monitor trading signals, track your trades, and analyze performance
        </p>
      </header>

      <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
        {/* Active Signals Card */}
        <div className='cyber-card'>
          <h3 className='text-lg font-semibold neon-yellow-text mb-2'>ACTIVE SIGNALS</h3>
          <div className='text-3xl font-bold mb-2'>{summary?.activeSignalsCount || 0}</div>
          <Link
            href='/dashboard/signals'
            className='text-sm text-neon-yellow hover:text-neon-pink transition-colors'>
            VIEW ALL SIGNALS →
          </Link>
        </div>

        {/* My Trades Card */}
        <div className='cyber-card'>
          <h3 className='text-lg font-semibold neon-blue-text mb-2'>MY TRADES</h3>
          <div className='text-3xl font-bold mb-2'>{summary?.tradesCount || 0}</div>
          <Link
            href='/dashboard/trades'
            className='text-sm text-neon-blue hover:text-neon-pink transition-colors'>
            VIEW MY TRADES →
          </Link>
        </div>

        {/* Win Rate Card */}
        <div className='cyber-card'>
          <h3 className='text-lg font-semibold neon-green-text mb-2'>WIN RATE</h3>
          <div className='text-3xl font-bold mb-2'>
            {summary?.overallPerformance?.winRate
              ? `${(summary.overallPerformance.winRate * 100).toFixed(1)}%`
              : 'N/A'}
          </div>
          <Link
            href='/dashboard/performance'
            className='text-sm text-neon-green hover:text-neon-pink transition-colors'>
            VIEW PERFORMANCE →
          </Link>
        </div>

        {/* Average Profit Card */}
        <div className='cyber-card'>
          <h3 className='text-lg font-semibold neon-text mb-2'>AVG PROFIT</h3>
          <div className='text-3xl font-bold mb-2'>
            {summary?.overallPerformance?.averageProfit
              ? `$${summary.overallPerformance.averageProfit.toFixed(2)}`
              : '$0.00'}
          </div>
          <div className='text-sm text-foreground/70'>
            {summary?.overallPerformance?.totalTrades || 0} total trades
          </div>
        </div>
      </div>

      {/* Recent Signals */}
      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-text mb-6'>RECENT TRADING SIGNALS</h2>

        {summary?.activeSignals && summary.activeSignals.length > 0 ? (
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-foreground/20'>
                  <th className='text-left pb-2 font-mono text-foreground/70'>COIN</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>DIRECTION</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>CONFIDENCE</th>
                  <th className='text-right pb-2 font-mono text-foreground/70'>PROFIT POTENTIAL</th>
                </tr>
              </thead>
              <tbody>
                {summary.activeSignals.map((signal) => (
                  <tr key={signal.id} className='border-b border-foreground/10'>
                    <td className='py-3 font-cyber'>
                      {signal.name} ({signal.symbol})
                    </td>
                    <td className='py-3'>
                      <span
                        className={`cyber-badge ${
                          signal.direction === 'buy' ? 'cyber-badge-buy' : 'cyber-badge-sell'
                        }`}>
                        {signal.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className='py-3'>
                      {typeof signal.confidence === 'number'
                        ? `${(signal.confidence * 100).toFixed(0)}%`
                        : 'N/A'}
                    </td>
                    <td className='py-3 text-right'>
                      {typeof signal.potential_profit === 'number'
                        ? `$${signal.potential_profit.toFixed(2)}`
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className='text-center py-10 text-foreground/50'>
            No active trading signals found
          </div>
        )}

        <div className='mt-4 text-right'>
          <Link href='/dashboard/signals' className='cyber-button inline-block'>
            VIEW ALL SIGNALS
          </Link>
        </div>
      </div>

      {/* Recent Trades */}
      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-text mb-6'>MY RECENT TRADES</h2>

        {summary?.recentTrades && summary.recentTrades.length > 0 ? (
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-foreground/20'>
                  <th className='text-left pb-2 font-mono text-foreground/70'>COIN</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>TYPE</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>DATE</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>STATUS</th>
                  <th className='text-right pb-2 font-mono text-foreground/70'>P/L</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentTrades.map((trade) => (
                  <tr key={trade.id} className='border-b border-foreground/10'>
                    <td className='py-3 font-cyber'>{trade.symbol}</td>
                    <td className='py-3'>
                      <span
                        className={`cyber-badge ${
                          trade.direction === 'buy' ? 'cyber-badge-buy' : 'cyber-badge-sell'
                        }`}>
                        {trade.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className='py-3 font-mono text-sm'>
                      {new Date(trade.created_at * 1000).toLocaleDateString()}
                    </td>
                    <td className='py-3'>
                      <span
                        className={`px-2 py-1 text-xs font-mono ${
                          trade.status === 'open'
                            ? 'bg-neon-blue/10 text-neon-blue'
                            : 'bg-neon-pink/10 text-neon-pink'
                        }`}>
                        {trade.status.toUpperCase()}
                      </span>
                    </td>
                    <td className='py-3 text-right font-mono'>
                      {trade.profit_loss !== null
                        ? `${trade.profit_loss >= 0 ? '+' : ''}$${trade.profit_loss.toFixed(2)}`
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className='text-center py-10 text-foreground/50'>
            No trades found. Start tracking your trades!
          </div>
        )}

        <div className='mt-4 text-right'>
          <Link href='/dashboard/trades' className='cyber-button inline-block'>
            VIEW ALL TRADES
          </Link>
        </div>
      </div>

      {/* Promotional Section */}
      <div className='relative overflow-hidden cyber-card border-neon-yellow'>
        <div className='flex flex-col md:flex-row gap-8 items-center'>
          <div className='md:w-2/3'>
            <h2 className='text-xl font-bold neon-yellow-text mb-4'>ADVANCED TRADING STRATEGIES</h2>
            <p className='mb-4 text-foreground/80'>
              Use CosmoVision's advanced AI to identify the best meme coin trading opportunities.
              Our signals combine sentiment analysis, on-chain metrics, and price predictions to
              maximize your profits.
            </p>
            <div className='mt-6'>
              <a
                href='https://t.me/CosmoVision_Bot'
                target='_blank'
                rel='noopener noreferrer'
                className='cyber-button'>
                CONNECT WITH BOT
              </a>
            </div>
          </div>
          <div className='md:w-1/3 flex justify-center'>
            {/* Placeholder for Milei image */}
            <div className='w-32 h-32 rounded-full bg-cyber-gradient flex items-center justify-center'>
              <span className='neon-yellow-text'>MILEI</span>
            </div>
          </div>
        </div>
      </div>

      {/* Milei Trading Strategy Promo */}
      <div className='cyber-card border-neon-yellow'>
        <div className='flex flex-col md:flex-row items-center gap-6'>
          <div className='flex-1'>
            <h2 className='text-xl font-bold neon-yellow-text mb-4'>MILEI STRATEGY</h2>
            <p className='mb-4'>
              The "Freedom-Based Trading Strategy" based on sound economic principles and the
              Austrian School of Economics, promoting liberty in markets.
            </p>
            <p className='text-neon-yellow font-cyber'>Lagrimas de zurdo. Freedom advances.</p>
            <div className='mt-6'>
              <button className='cyber-button-sm'>LEARN MORE</button>
            </div>
          </div>
          <div className='shrink-0'>
            <div className='relative w-40 h-40 overflow-hidden'>
              <div className='absolute inset-0 bg-neon-yellow opacity-20 border-2 border-neon-yellow animate-pulse' />
              <img
                src='/images/milei-placeholder.jpg'
                alt='Javier Milei'
                className='w-full h-full object-cover'
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/images/milei-placeholder.jpg';
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
