'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';
import Link from 'next/link';

export default function SignalsPage() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    direction: 'all',
    chain: 'all',
    minConfidence: 0,
  });

  useEffect(() => {
    async function fetchSignals() {
      try {
        setLoading(true);
        const data = await api.getTradingSignals(filters);
        setSignals(data.signals || []);
      } catch (err) {
        console.error('Error fetching signals:', err);
        setError('Failed to load trading signals. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchSignals();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Filter signals based on selected filters
  const filteredSignals = signals.filter((signal) => {
    if (filters.direction !== 'all' && signal.direction !== filters.direction) {
      return false;
    }

    if (filters.chain !== 'all' && signal.chain !== filters.chain) {
      return false;
    }

    if (signal.confidence < filters.minConfidence / 100) {
      return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className='cyber-card animate-pulse'>
        <h2 className='neon-text text-xl'>LOADING SIGNALS...</h2>
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
        <h1 className='text-3xl font-bold neon-text mb-2'>TRADING SIGNALS</h1>
        <p className='text-foreground/70'>
          View and filter active trading signals based on market sentiment and price analysis
        </p>
      </header>

      {/* Filters */}
      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-blue-text mb-6'>FILTER OPTIONS</h2>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          {/* Direction Filter */}
          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>
              SIGNAL DIRECTION
            </label>
            <select
              value={filters.direction}
              onChange={(e) => handleFilterChange('direction', e.target.value)}
              className='cyber-input w-full'>
              <option value='all'>All Directions</option>
              <option value='buy'>Buy Only</option>
              <option value='sell'>Sell Only</option>
            </select>
          </div>

          {/* Chain Filter */}
          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>BLOCKCHAIN</label>
            <select
              value={filters.chain}
              onChange={(e) => handleFilterChange('chain', e.target.value)}
              className='cyber-input w-full'>
              <option value='all'>All Chains</option>
              <option value='BSC'>Binance Smart Chain</option>
              <option value='ETH'>Ethereum</option>
              <option value='NEAR'>NEAR Protocol</option>
            </select>
          </div>

          {/* Confidence Filter */}
          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>
              MIN CONFIDENCE: {filters.minConfidence}%
            </label>
            <input
              type='range'
              min='0'
              max='100'
              value={filters.minConfidence}
              onChange={(e) => handleFilterChange('minConfidence', parseInt(e.target.value))}
              className='w-full'
            />
          </div>
        </div>
      </div>

      {/* Signals Table */}
      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-text mb-6'>ACTIVE TRADING SIGNALS</h2>

        {filteredSignals.length > 0 ? (
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-foreground/20'>
                  <th className='text-left pb-2 font-mono text-foreground/70'>COIN</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>CHAIN</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>DIRECTION</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>CONFIDENCE</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>REASON</th>
                  <th className='text-right pb-2 font-mono text-foreground/70'>PROFIT POTENTIAL</th>
                  <th className='text-right pb-2 font-mono text-foreground/70'>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSignals.map((signal) => (
                  <tr key={signal.id} className='border-b border-foreground/10'>
                    <td className='py-3 font-cyber'>
                      {signal.name} ({signal.symbol})
                    </td>
                    <td className='py-3 font-mono text-sm'>{signal.chain || 'BSC'}</td>
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
                    <td className='py-3 text-sm max-w-[200px] truncate'>
                      {signal.reason || 'Based on market analysis'}
                    </td>
                    <td className='py-3 text-right'>
                      {typeof signal.potential_profit === 'number'
                        ? `$${signal.potential_profit.toFixed(2)}`
                        : 'N/A'}
                    </td>
                    <td className='py-3 text-right'>
                      <button className='border border-neon-pink text-neon-pink px-2 py-1 text-xs hover:bg-neon-pink/10 transition-colors'>
                        SAVE TRADE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className='text-center py-10 text-foreground/50'>
            No trading signals match your filters
          </div>
        )}
      </div>

      {/* Explanation Card */}
      <div className='cyber-card border-neon-blue/50'>
        <h2 className='text-xl font-bold neon-blue-text mb-4'>ABOUT TRADING SIGNALS</h2>
        <p className='mb-4 text-foreground/80'>
          Trading signals are generated using advanced AI analysis of market sentiment, price
          trends, and on-chain metrics. Each signal includes:
        </p>
        <ul className='list-disc list-inside space-y-2 text-foreground/70'>
          <li>
            <span className='text-neon-blue'>Direction</span> - Whether to buy or sell the token
          </li>
          <li>
            <span className='text-neon-blue'>Confidence</span> - AI confidence level in the signal
            (higher is better)
          </li>
          <li>
            <span className='text-neon-blue'>Profit Potential</span> - Estimated profit per $100
            invested
          </li>
          <li>
            <span className='text-neon-blue'>Reason</span> - Key factors that generated this signal
          </li>
        </ul>
        <div className='mt-6 p-4 border border-neon-pink/30 bg-neon-pink/5'>
          <p className='text-sm'>
            <span className='text-neon-pink font-bold'>DISCLAIMER:</span> Trading signals are for
            informational purposes only. Always do your own research before making investment
            decisions. Cryptocurrency trading involves substantial risk.
          </p>
        </div>
      </div>
    </div>
  );
}
