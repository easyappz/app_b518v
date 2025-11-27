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
import Transactions from './components/Transactions';
import Statistics from './components/Statistics';
import Notifications from './components/Notifications';
import NotFound from './components/NotFound';
import Admin from './components/Admin';

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
        '/login',
        '/register',
        '/r/:code',
        '/dashboard',
        '/referrals',
        '/transactions',
        '/statistics',
        '/notifications',
        '/admin',
        '/admin/dashboard',
        '/admin/users',
        '/admin/users/:userId',
        '/admin/transactions',
        '/admin/withdrawals',
        '/admin/analytics',
        '*'
      ]);
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/r/:code" element={<ReferralRegister />} />
          <Route path="/dashboard" element={<PlayerDashboard />} />
          <Route path="/referrals" element={<ReferralTree />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
