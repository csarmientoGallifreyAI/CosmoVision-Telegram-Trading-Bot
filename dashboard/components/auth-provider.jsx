'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api';

// Create auth context
const AuthContext = createContext(undefined);

/**
 * User authentication state and methods
 * @typedef {Object} AuthContextValue
 * @property {Object|null} user - Current user data
 * @property {boolean} loading - Whether auth state is loading
 * @property {Function} login - Login with telegramId and authCode
 * @property {Function} logout - Log the user out
 */

/**
 * Provider component for authentication context
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check for stored authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (api.isAuthenticated()) {
          // Fetch user profile if we have a token
          const userData = await api.get('/api/tradingDashboard', { endpoint: 'me' });
          if (userData && !userData.error) {
            setUser(userData);
          } else {
            // Invalid token or error
            api.clearToken();
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        api.clearToken();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  /**
   * Log in a user with Telegram ID and auth code
   * @param {string} telegramId - Telegram user ID
   * @param {string} authCode - Authentication code
   * @returns {Promise<boolean>} - Success status
   */
  const login = async (telegramId, authCode) => {
    try {
      setLoading(true);
      const response = await api.authenticate(telegramId, authCode);

      if (response.user) {
        setUser(response.user);
        router.push('/dashboard');
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Log out the current user
   */
  const logout = () => {
    api.clearToken();
    setUser(null);
    router.push('/auth/login');
  };

  // Context value
  const value = {
    user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use authentication context
 * @returns {AuthContextValue} Auth context value
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
