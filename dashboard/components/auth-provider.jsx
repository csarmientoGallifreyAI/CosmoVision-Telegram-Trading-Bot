'use client';

import { createContext, useState, useContext, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '../lib/api';

// Create context
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check if user is authenticated on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if we have a token in localStorage
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

        if (token) {
          // Verify token validity by making a request to get user data
          try {
            const userData = await api.get('/api/tradingDashboard/summary');
            if (userData) {
              setUser(userData);
            } else {
              // If no user data, token is invalid
              api.clearToken();
              // Only redirect if we're not already on the login page
              if (pathname !== '/auth/login') {
                router.push('/auth/login');
              }
            }
          } catch (err) {
            // On error, clear token and redirect to login
            api.clearToken();
            if (pathname !== '/auth/login') {
              router.push('/auth/login');
            }
          }
        } else if (pathname !== '/auth/login' && pathname !== '/') {
          // If no token and not on login page, redirect to login
          router.push('/auth/login');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, pathname]);

  // Login function
  const login = async (token, userData) => {
    api.setToken(token);
    setUser(userData);
    router.push('/dashboard');
  };

  // Logout function
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
    isAuthenticated: !!user,
  };

  // Render
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
