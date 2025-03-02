'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../components/auth-provider';
import api from '../../../lib/api';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const [settings, setSettings] = useState({
    notifications: {
      newSignals: true,
      priceAlerts: true,
      tradeExecutions: true,
      performanceReports: false,
    },
    tradingPreferences: {
      autoTrade: false,
      maxDailyTrades: 5,
      riskLevel: 'medium',
      tradeSize: 'small',
    },
    displayPreferences: {
      theme: 'dark',
      chartStyle: 'candlestick',
      currency: 'USD',
      timezone: 'UTC',
    },
    apiAccess: {
      enabled: false,
      lastGenerated: null,
    },
  });

  useEffect(() => {
    async function fetchUserSettings() {
      try {
        setLoading(true);
        const data = await api.getUserSettings();
        if (data && data.settings) {
          setSettings(data.settings);
        }
      } catch (err) {
        console.error('Error fetching user settings:', err);
        setError('Failed to load settings. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchUserSettings();
  }, []);

  const handleSettingChange = (category, setting, value) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value,
      },
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await api.updateUserSettings(settings);

      setSuccess('Settings updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateApiKey = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await api.generateApiKey();

      if (result && result.apiKey) {
        // Show the API key to the user (only shown once)
        alert(
          `Your API Key: ${result.apiKey}\n\nSave this key securely. It will not be shown again.`
        );

        setSettings((prev) => ({
          ...prev,
          apiAccess: {
            enabled: true,
            lastGenerated: new Date().toISOString(),
          },
        }));
      }
    } catch (err) {
      console.error('Error generating API key:', err);
      setError('Failed to generate API key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className='cyber-card animate-pulse'>
        <h2 className='neon-text text-xl'>LOADING SETTINGS...</h2>
      </div>
    );
  }

  return (
    <div className='space-y-8'>
      <header>
        <h1 className='text-3xl font-bold neon-text mb-2'>SYSTEM SETTINGS</h1>
        <p className='text-foreground/70'>Configure your dashboard and trading preferences</p>
      </header>

      {success && (
        <div className='cyber-card border-neon-green p-4'>
          <p className='text-neon-green'>{success}</p>
        </div>
      )}

      {error && (
        <div className='cyber-card border-destructive p-4'>
          <p className='text-destructive'>{error}</p>
        </div>
      )}

      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-blue-text mb-6'>USER PROFILE</h2>

        <div className='space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <label className='block font-mono text-sm text-foreground/70 mb-2'>TELEGRAM ID</label>
              <input
                type='text'
                value={user?.telegram_id || 'Not available'}
                readOnly
                className='cyber-input w-full'
              />
            </div>

            <div>
              <label className='block font-mono text-sm text-foreground/70 mb-2'>USERNAME</label>
              <input
                type='text'
                value={user?.username || 'Not available'}
                readOnly
                className='cyber-input w-full'
              />
            </div>
          </div>

          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>
              ACCOUNT STATUS
            </label>
            <div className='flex items-center space-x-2'>
              <span className='inline-block w-3 h-3 rounded-full bg-neon-green'></span>
              <span>Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-text mb-6'>NOTIFICATION SETTINGS</h2>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <label className='flex items-center space-x-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={settings.notifications.newSignals}
                onChange={(e) =>
                  handleSettingChange('notifications', 'newSignals', e.target.checked)
                }
                className='cyber-checkbox'
              />
              <span>New Trading Signals</span>
            </label>
          </div>

          <div>
            <label className='flex items-center space-x-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={settings.notifications.priceAlerts}
                onChange={(e) =>
                  handleSettingChange('notifications', 'priceAlerts', e.target.checked)
                }
                className='cyber-checkbox'
              />
              <span>Price Alerts</span>
            </label>
          </div>

          <div>
            <label className='flex items-center space-x-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={settings.notifications.tradeExecutions}
                onChange={(e) =>
                  handleSettingChange('notifications', 'tradeExecutions', e.target.checked)
                }
                className='cyber-checkbox'
              />
              <span>Trade Executions</span>
            </label>
          </div>

          <div>
            <label className='flex items-center space-x-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={settings.notifications.performanceReports}
                onChange={(e) =>
                  handleSettingChange('notifications', 'performanceReports', e.target.checked)
                }
                className='cyber-checkbox'
              />
              <span>Weekly Performance Reports</span>
            </label>
          </div>
        </div>
      </div>

      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-text mb-6'>TRADING PREFERENCES</h2>

        <div className='space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <label className='block font-mono text-sm text-foreground/70 mb-2'>RISK LEVEL</label>
              <select
                value={settings.tradingPreferences.riskLevel}
                onChange={(e) =>
                  handleSettingChange('tradingPreferences', 'riskLevel', e.target.value)
                }
                className='cyber-input w-full'>
                <option value='low'>Low Risk</option>
                <option value='medium'>Medium Risk</option>
                <option value='high'>High Risk</option>
              </select>
            </div>

            <div>
              <label className='block font-mono text-sm text-foreground/70 mb-2'>TRADE SIZE</label>
              <select
                value={settings.tradingPreferences.tradeSize}
                onChange={(e) =>
                  handleSettingChange('tradingPreferences', 'tradeSize', e.target.value)
                }
                className='cyber-input w-full'>
                <option value='small'>Small ($10-$50)</option>
                <option value='medium'>Medium ($50-$200)</option>
                <option value='large'>Large ($200-$1000)</option>
              </select>
            </div>
          </div>

          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>
              MAX DAILY TRADES
            </label>
            <input
              type='number'
              min='1'
              max='20'
              value={settings.tradingPreferences.maxDailyTrades}
              onChange={(e) =>
                handleSettingChange(
                  'tradingPreferences',
                  'maxDailyTrades',
                  parseInt(e.target.value) || 1
                )
              }
              className='cyber-input w-full md:w-1/4'
            />
          </div>

          <div>
            <label className='flex items-center space-x-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={settings.tradingPreferences.autoTrade}
                onChange={(e) =>
                  handleSettingChange('tradingPreferences', 'autoTrade', e.target.checked)
                }
                className='cyber-checkbox'
              />
              <span className='font-semibold text-neon-pink'>
                Enable Auto-Trading (Coming Soon)
              </span>
            </label>
            {settings.tradingPreferences.autoTrade && (
              <p className='text-foreground/70 text-sm mt-2 ml-7'>
                Auto-trading is not yet available. This feature will be enabled in a future update.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-text mb-6'>DISPLAY PREFERENCES</h2>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>THEME</label>
            <select
              value={settings.displayPreferences.theme}
              onChange={(e) => handleSettingChange('displayPreferences', 'theme', e.target.value)}
              className='cyber-input w-full'>
              <option value='dark'>Cyberpunk Dark</option>
              <option value='light'>Cyberpunk Light</option>
              <option value='matrix'>Matrix Green</option>
              <option value='retro'>Retro Wave</option>
            </select>
          </div>

          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>CHART STYLE</label>
            <select
              value={settings.displayPreferences.chartStyle}
              onChange={(e) =>
                handleSettingChange('displayPreferences', 'chartStyle', e.target.value)
              }
              className='cyber-input w-full'>
              <option value='candlestick'>Candlestick</option>
              <option value='line'>Line Chart</option>
              <option value='bar'>Bar Chart</option>
            </select>
          </div>

          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>CURRENCY</label>
            <select
              value={settings.displayPreferences.currency}
              onChange={(e) =>
                handleSettingChange('displayPreferences', 'currency', e.target.value)
              }
              className='cyber-input w-full'>
              <option value='USD'>USD ($)</option>
              <option value='EUR'>EUR (€)</option>
              <option value='GBP'>GBP (£)</option>
              <option value='JPY'>JPY (¥)</option>
            </select>
          </div>

          <div>
            <label className='block font-mono text-sm text-foreground/70 mb-2'>TIMEZONE</label>
            <select
              value={settings.displayPreferences.timezone}
              onChange={(e) =>
                handleSettingChange('displayPreferences', 'timezone', e.target.value)
              }
              className='cyber-input w-full'>
              <option value='UTC'>UTC</option>
              <option value='EST'>Eastern Time (EST)</option>
              <option value='PST'>Pacific Time (PST)</option>
              <option value='GMT'>Greenwich Mean Time (GMT)</option>
              <option value='JST'>Japan Standard Time (JST)</option>
            </select>
          </div>
        </div>
      </div>

      <div className='cyber-card'>
        <h2 className='text-xl font-bold neon-text mb-6'>API ACCESS</h2>

        <div className='space-y-4'>
          <p className='text-foreground/70'>
            Generate an API key to access your trading data programmatically. This key will give
            read-only access to your trading history and signals.
          </p>

          <div className='mt-4'>
            <button onClick={handleGenerateApiKey} disabled={loading} className='cyber-button'>
              {loading ? 'GENERATING...' : 'GENERATE NEW API KEY'}
            </button>

            {settings.apiAccess.lastGenerated && (
              <p className='text-sm text-foreground/70 mt-2'>
                Last key generated: {new Date(settings.apiAccess.lastGenerated).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className='flex justify-between items-center'>
        <button onClick={handleSaveSettings} disabled={loading} className='cyber-button'>
          {loading ? 'SAVING...' : 'SAVE SETTINGS'}
        </button>

        <button onClick={logout} className='cyber-button-secondary'>
          LOGOUT
        </button>
      </div>
    </div>
  );
}
