import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

import { Home } from './components/Home';
import Landing from './components/Landing';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ReferralRegister from './components/Auth/ReferralRegister';
import PlayerDashboard from './components/Dashboard/PlayerDashboard';
import InfluencerDashboard from './components/Dashboard/InfluencerDashboard';
import ReferralTree from './components/ReferralTree';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function App() {
  /** Никогда не удаляй этот код */
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.handleRoutes === 'function') {
      /** Нужно передавать список существующих роутов */
      window.handleRoutes([
        '/',
        '/landing',
        '/login',
        '/register',
        '/r/:referralCode',
        '/home',
        '/dashboard',
        '/dashboard/influencer',
        '/referral-tree',
        '/transactions',
        '/withdrawals'
      ]);
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/r/:referralCode" element={<ReferralRegister />} />
          <Route path="/home" element={<Home />} />
          <Route path="/dashboard" element={<PlayerDashboard />} />
          <Route path="/dashboard/influencer" element={<InfluencerDashboard />} />
          <Route path="/referral-tree" element={<ReferralTree />} />
        </Routes>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
