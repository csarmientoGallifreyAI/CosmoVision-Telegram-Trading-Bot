'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';
import Link from 'next/link';

export default function TradesPage() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    direction: 'all',
    sortBy: 'date',
    sortOrder: 'desc',
  });

  useEffect(() => {
    async function fetchTrades() {
      try {
        setLoading(true);
        const data = await api.getUserTrades(filters);
        setTrades(data.trades || []);
      } catch (err) {
        console.error('Error fetching trades:', err);
        setError('Failed to load your trades. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchTrades();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const sortTrades = (tradesArray) => {
    return [...tradesArray].sort((a, b) => {
      switch (filters.sortBy) {
        case 'date':
          return filters.sortOrder === 'desc'
            ? b.created_at - a.created_at
            : a.created_at - b.created_at;
        case 'profitLoss':
          const profitA = a.profit_loss || 0;
          const profitB = b.profit_loss || 0;
          return filters.sortOrder === 'desc' ? profitB - profitA : profitA - profitB;
        case 'coin':
          return filters.sortOrder === 'desc'
            ? b.symbol.localeCompare(a.symbol)
            : a.symbol.localeCompare(b.symbol);
        default:
          return 0;
      }
    });
  };

  // Filter and sort trades
  const filteredTrades = sortTrades(
    trades.filter((trade) => {
      if (filters.status !== 'all' && trade.status !== filters.status) {
        return false;
      }

      if (filters.direction !== 'all' && trade.direction !== filters.direction) {
        return false;
      }

      return true;
    })
  );

  if (loading) {
    return (
      <div className='cyber-card animate-pulse'>
        <h2 className='neon-text text-xl'>LOADING TRADES...</h2>
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
        <h1 className='text-3xl font-bold neon-text mb-2'>MY TRADES</h1>
        <p className='text-foreground/70'>Track and manage your trading history and performance</p>
      </header>

      {/* Filters */}
      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-blue-text mb-6'>FILTER & SORT</h2>

        <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
          {/* Status Filter */}
          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>TRADE STATUS</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className='cyber-input w-full'>
              <option value='all'>All Statuses</option>
              <option value='open'>Open Trades</option>
              <option value='closed'>Closed Trades</option>
            </select>
          </div>

          {/* Direction Filter */}
          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>
              TRADE DIRECTION
            </label>
            <select
              value={filters.direction}
              onChange={(e) => handleFilterChange('direction', e.target.value)}
              className='cyber-input w-full'>
              <option value='all'>All Directions</option>
              <option value='buy'>Buy Trades</option>
              <option value='sell'>Sell Trades</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>SORT BY</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className='cyber-input w-full'>
              <option value='date'>Date</option>
              <option value='profitLoss'>Profit/Loss</option>
              <option value='coin'>Coin Name</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>SORT ORDER</label>
            <select
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
              className='cyber-input w-full'>
              <option value='desc'>Descending</option>
              <option value='asc'>Ascending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trades Table */}
      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-text mb-6'>TRADE HISTORY</h2>

        {filteredTrades.length > 0 ? (
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-foreground/20'>
                  <th className='text-left pb-2 font-mono text-foreground/70'>COIN</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>DIRECTION</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>AMOUNT</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>ENTRY PRICE</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>DATE</th>
                  <th className='text-left pb-2 font-mono text-foreground/70'>STATUS</th>
                  <th className='text-right pb-2 font-mono text-foreground/70'>P/L</th>
                  <th className='text-right pb-2 font-mono text-foreground/70'>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade) => (
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
                    <td className='py-3 font-mono'>${trade.amount?.toFixed(2) || 'N/A'}</td>
                    <td className='py-3 font-mono'>${trade.price_at_trade?.toFixed(6) || 'N/A'}</td>
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
                    <td className='py-3 text-right'>
                      {trade.status === 'open' ? (
                        <button className='border border-neon-pink text-neon-pink px-2 py-1 text-xs hover:bg-neon-pink/10 transition-colors'>
                          CLOSE
                        </button>
                      ) : (
                        <button className='border border-neon-blue text-neon-blue px-2 py-1 text-xs hover:bg-neon-blue/10 transition-colors'>
                          DETAILS
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className='text-center py-10 text-foreground/50'>
            No trades found matching your filters
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div className='cyber-card'>
          <h3 className='text-lg font-semibold neon-yellow-text mb-2'>TOTAL TRADES</h3>
          <div className='text-3xl font-bold mb-2'>{trades.length}</div>
          <div className='text-sm text-foreground/70'>
            Open: {trades.filter((t) => t.status === 'open').length} / Closed:{' '}
            {trades.filter((t) => t.status === 'closed').length}
          </div>
        </div>

        <div className='cyber-card'>
          <h3 className='text-lg font-semibold neon-green-text mb-2'>PROFIT TRADES</h3>
          <div className='text-3xl font-bold mb-2'>
            {trades.filter((t) => t.profit_loss !== null && t.profit_loss > 0).length}
          </div>
          <div className='text-sm text-foreground/70'>
            Win Rate:{' '}
            {trades.filter((t) => t.status === 'closed').length > 0
              ? `${Math.round(
                  (trades.filter((t) => t.profit_loss !== null && t.profit_loss > 0).length /
                    trades.filter((t) => t.status === 'closed').length) *
                    100
                )}%`
              : 'N/A'}
          </div>
        </div>

        <div className='cyber-card'>
          <h3 className='text-lg font-semibold neon-text mb-2'>TOTAL P/L</h3>
          <div className='text-3xl font-bold mb-2'>
            {(() => {
              const total = trades.reduce((sum, trade) => sum + (trade.profit_loss || 0), 0);
              return `${total >= 0 ? '+' : ''}$${total.toFixed(2)}`;
            })()}
          </div>
          <div className='text-sm text-foreground/70'>
            Average:{' '}
            {trades.filter((t) => t.profit_loss !== null).length > 0
              ? `$${(
                  trades.reduce((sum, trade) => sum + (trade.profit_loss || 0), 0) /
                  trades.filter((t) => t.profit_loss !== null).length
                ).toFixed(2)}`
              : '$0.00'}
          </div>
        </div>
      </div>

      {/* Add Trade Button */}
      <div className='text-center mt-8'>
        <button className='cyber-button'>ADD MANUAL TRADE</button>
      </div>
    </div>
  );
}
