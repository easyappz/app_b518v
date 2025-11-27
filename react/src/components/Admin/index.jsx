import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import Dashboard from './Dashboard';
import Users from './Users';
import UserDetail from './Users/UserDetail';
import AdminTransactions from './Transactions';
import Withdrawals from './Withdrawals';
import Analytics from './Analytics';
import './styles.css';

const Admin = () => {
  const { user, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && (!user || !user.is_admin)) {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div data-easytag="id14-src/components/Admin" className="admin-loading">
        <div className="loading-spinner">Загрузка...</div>
      </div>
    );
  }

  if (!user || !user.is_admin) {
    return null;
  }

  return (
    <div data-easytag="id14-src/components/Admin" className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <h2>Poker Chain</h2>
          <span className="admin-badge">Admin</span>
        </div>
        <nav className="admin-nav">
          <a href="/admin" className={window.location.pathname === '/admin' ? 'active' : ''}>
            <span className="nav-icon">📊</span>
            Дашборд
          </a>
          <a href="/admin/users" className={window.location.pathname.includes('/admin/users') ? 'active' : ''}>
            <span className="nav-icon">👥</span>
            Пользователи
          </a>
          <a href="/admin/transactions" className={window.location.pathname === '/admin/transactions' ? 'active' : ''}>
            <span className="nav-icon">💰</span>
            Транзакции
          </a>
          <a href="/admin/withdrawals" className={window.location.pathname === '/admin/withdrawals' ? 'active' : ''}>
            <span className="nav-icon">💸</span>
            Выводы
          </a>
          <a href="/admin/analytics" className={window.location.pathname === '/admin/analytics' ? 'active' : ''}>
            <span className="nav-icon">📈</span>
            Аналитика
          </a>
        </nav>
        <div className="admin-footer">
          <a href="/dashboard" className="back-to-site">
            <span className="nav-icon">🏠</span>
            Вернуться на сайт
          </a>
        </div>
      </aside>
      <main className="admin-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:userId" element={<UserDetail />} />
          <Route path="/transactions" element={<AdminTransactions />} />
          <Route path="/withdrawals" element={<Withdrawals />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default Admin;
