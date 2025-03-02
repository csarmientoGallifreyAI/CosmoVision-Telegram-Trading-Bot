'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';

export default function PerformancePage() {
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('30d'); // Default to 30 days

  useEffect(() => {
    async function fetchPerformanceData() {
      try {
        setLoading(true);
        const data = await api.getPerformanceMetrics(timeframe);
        setPerformance(data);
      } catch (err) {
        console.error('Error fetching performance data:', err);
        setError('Failed to load performance metrics. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchPerformanceData();
  }, [timeframe]);

  if (loading) {
    return (
      <div className='cyber-card animate-pulse'>
        <h2 className='neon-text text-xl'>CALCULATING METRICS...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className='cyber-card border-destructive'>
        <h2 className='text-destructive text-xl mb-4'>System Malfunction</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className='cyber-button mt-4'>
          RETRY
        </button>
      </div>
    );
  }

  // Mock performance data structure until real API is connected
  const mockPerformance = performance || {
    profitLoss: {
      total: 1257.82,
      monthly: 348.21,
      weekly: 127.65,
      daily: 23.41,
    },
    winRate: {
      overall: 68,
      buy: 72,
      sell: 61,
    },
    trades: {
      total: 42,
      successful: 28,
      failed: 14,
    },
    roi: {
      overall: 18.7,
      monthly: 5.2,
      weekly: 1.8,
    },
    bestTrade: {
      coin: 'MILEI',
      profit: 421.73,
      date: '2023-12-15',
    },
    worstTrade: {
      coin: 'DOGE',
      loss: -182.45,
      date: '2023-11-30',
    },
    dailyPerformance: [
      { date: '2023-12-01', value: 12.45 },
      { date: '2023-12-02', value: 18.72 },
      { date: '2023-12-03', value: -5.34 },
      { date: '2023-12-04', value: 2.56 },
      { date: '2023-12-05', value: 15.23 },
      { date: '2023-12-06', value: 11.67 },
      { date: '2023-12-07', value: -8.91 },
    ],
    tradingPairs: [
      { name: 'MILEI', percentage: 35 },
      { name: 'BTC', percentage: 25 },
      { name: 'ETH', percentage: 15 },
      { name: 'DOGE', percentage: 10 },
      { name: 'SHIB', percentage: 15 },
    ],
  };

  return (
    <div className='space-y-8'>
      <header className='flex flex-wrap justify-between items-center'>
        <div>
          <h1 className='text-3xl font-bold neon-text mb-2'>PERFORMANCE ANALYTICS</h1>
          <p className='text-foreground/70'>
            Track your trading performance and analyze your strategy effectiveness
          </p>
        </div>

        <div className='cyber-card-mini p-4 mt-4 md:mt-0'>
          <label className='block font-mono text-sm text-foreground/70 mb-2'>TIMEFRAME</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className='cyber-input'>
            <option value='7d'>Last 7 Days</option>
            <option value='30d'>Last 30 Days</option>
            <option value='90d'>Last 90 Days</option>
            <option value='180d'>Last 6 Months</option>
            <option value='365d'>Last Year</option>
            <option value='all'>All Time</option>
          </select>
        </div>
      </header>

      {/* Key Metrics */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
        <div className='cyber-card'>
          <h3 className='text-lg font-semibold neon-green-text mb-2'>TOTAL P/L</h3>
          <div className='text-3xl font-bold mb-2'>
            ${mockPerformance.profitLoss.total.toFixed(2)}
          </div>
          <div className='text-sm text-foreground/70'>
            Daily: ${mockPerformance.profitLoss.daily.toFixed(2)}
          </div>
        </div>

        <div className='cyber-card'>
          <h3 className='text-lg font-semibold neon-blue-text mb-2'>WIN RATE</h3>
          <div className='text-3xl font-bold mb-2'>{mockPerformance.winRate.overall}%</div>
          <div className='text-sm text-foreground/70'>
            Buy: {mockPerformance.winRate.buy}% / Sell: {mockPerformance.winRate.sell}%
          </div>
        </div>

        <div className='cyber-card'>
          <h3 className='text-lg font-semibold neon-yellow-text mb-2'>TOTAL TRADES</h3>
          <div className='text-3xl font-bold mb-2'>{mockPerformance.trades.total}</div>
          <div className='text-sm text-foreground/70'>
            Success: {mockPerformance.trades.successful} / Failed: {mockPerformance.trades.failed}
          </div>
        </div>

        <div className='cyber-card'>
          <h3 className='text-lg font-semibold neon-purple-text mb-2'>ROI</h3>
          <div className='text-3xl font-bold mb-2'>{mockPerformance.roi.overall}%</div>
          <div className='text-sm text-foreground/70'>Monthly: {mockPerformance.roi.monthly}%</div>
        </div>
      </div>

      {/* Performance Chart (Placeholder for actual chart) */}
      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-text mb-6'>PROFIT/LOSS TIMELINE</h2>

        {/* This would be a real chart component in production */}
        <div className='h-64 bg-background/30 border border-foreground/20 rounded-md mb-4 flex items-center justify-center'>
          <div className='text-center p-8'>
            <p className='mb-4'>
              {mockPerformance.dailyPerformance.map((day, index) => (
                <span
                  key={index}
                  className={`inline-block h-${Math.abs(day.value * 2)} w-4 mx-1 ${
                    day.value >= 0 ? 'bg-neon-green/70' : 'bg-neon-pink/70'
                  }`}
                  style={{
                    height: `${Math.abs(day.value) * 2}px`,
                    marginTop: day.value >= 0 ? 'auto' : '0',
                  }}
                  title={`${day.date}: $${day.value}`}
                />
              ))}
            </p>
            <p className='text-foreground/50 font-mono text-sm'>
              Chart visualization will display P/L over time
            </p>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <h3 className='font-cyber text-neon-green mb-2'>GAINS</h3>
            <ul>
              <li className='flex justify-between py-2 border-b border-foreground/10'>
                <span className='font-mono'>Daily Average</span>
                <span className='font-bold'>${mockPerformance.profitLoss.daily.toFixed(2)}</span>
              </li>
              <li className='flex justify-between py-2 border-b border-foreground/10'>
                <span className='font-mono'>Weekly</span>
                <span className='font-bold'>${mockPerformance.profitLoss.weekly.toFixed(2)}</span>
              </li>
              <li className='flex justify-between py-2'>
                <span className='font-mono'>Monthly</span>
                <span className='font-bold'>${mockPerformance.profitLoss.monthly.toFixed(2)}</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className='font-cyber text-neon-blue mb-2'>TOP PERFORMING PAIRS</h3>
            <ul>
              {mockPerformance.tradingPairs.map((pair, index) => (
                <li
                  key={index}
                  className='flex justify-between py-2 border-b border-foreground/10 last:border-b-0'>
                  <span className='font-mono'>{pair.name}</span>
                  <span className='font-bold'>{pair.percentage}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Best & Worst Trades */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <div className='cyber-card'>
          <h2 className='text-xl font-bold text-neon-green mb-6'>BEST TRADE</h2>
          <div className='space-y-4'>
            <div className='flex justify-between items-center'>
              <span className='font-cyber text-2xl'>{mockPerformance.bestTrade.coin}</span>
              <span className='font-mono text-xl text-neon-green'>
                +${mockPerformance.bestTrade.profit.toFixed(2)}
              </span>
            </div>
            <div className='text-sm text-foreground/70'>Date: {mockPerformance.bestTrade.date}</div>
            <div className='mt-4 cyber-button-sm'>VIEW DETAILS</div>
          </div>
        </div>

        <div className='cyber-card'>
          <h2 className='text-xl font-bold text-neon-pink mb-6'>WORST TRADE</h2>
          <div className='space-y-4'>
            <div className='flex justify-between items-center'>
              <span className='font-cyber text-2xl'>{mockPerformance.worstTrade.coin}</span>
              <span className='font-mono text-xl text-neon-pink'>
                ${mockPerformance.worstTrade.loss.toFixed(2)}
              </span>
            </div>
            <div className='text-sm text-foreground/70'>
              Date: {mockPerformance.worstTrade.date}
            </div>
            <div className='mt-4 cyber-button-sm'>VIEW DETAILS</div>
          </div>
        </div>
      </div>

      {/* Performance Tips */}
      <div className='cyber-card border-neon-blue'>
        <h2 className='text-xl font-bold neon-blue-text mb-4'>OPTIMIZATION TIPS</h2>
        <div className='space-y-4'>
          <p>
            Based on your trading patterns, here are some AI-generated tips to improve your
            performance:
          </p>
          <ul className='list-disc list-inside space-y-2 text-foreground/80'>
            <li>
              Consider increasing position sizes for {mockPerformance.tradingPairs[0].name}, your
              best performing coin
            </li>
            <li>
              Your win rate for sell orders is {mockPerformance.winRate.sell}%, which is below your
              buy win rate. Consider adjusting your sell strategy
            </li>
            <li>The optimal holding time based on your successful trades appears to be 3-5 days</li>
          </ul>
          <div className='mt-6 text-center'>
            <button className='cyber-button-sm'>GENERATE DETAILED REPORT</button>
          </div>
        </div>
      </div>
    </div>
  );
}
