import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Wallet, Bell, LogOut, Menu, X } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useNotificationStore from '../../store/notificationStore';
import { logout } from '../../api/auth';
import './styles.css';

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout: logoutStore } = useAuthStore();
  const { unreadCount, fetchNotifications } = useNotificationStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [isAuthenticated, fetchNotifications]);

  const handleLogout = async () => {
    try {
      await logout();
      logoutStore();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navigationItems = [
    { path: '/', icon: Home, label: 'Главная' },
    { path: '/referrals', icon: Users, label: 'Рефералы' },
    { path: '/wallet', icon: Wallet, label: 'Кошелек' },
    { path: '/notifications', icon: Bell, label: 'Уведомления', badge: unreadCount },
  ];

  const isActivePath = (path) => location.pathname === path;

  return (
    <div className="layout" data-easytag="id1-src/components/Layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-only">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-text">Poker Chain</span>
            <div className="logo-glow"></div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActivePath(item.path) ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {item.badge > 0 && <span className="badge">{item.badge}</span>}
            </Link>
          ))}
        </nav>

        {isAuthenticated && (
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Выйти</span>
          </button>
        )}
      </aside>

      {/* Mobile Header */}
      <header className="mobile-header mobile-only">
        <button 
          className="menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className="logo-mobile">
          <span className="logo-text">Poker Chain</span>
        </div>

        {isAuthenticated && user && (
          <div className="balance-mobile">
            <span className="balance-amount">
              {user.user_type === 'influencer' ? '₽' : 'V'}
            </span>
          </div>
        )}
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <nav className="mobile-nav">
              {navigationItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item ${isActivePath(item.path) ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                  {item.badge > 0 && <span className="badge">{item.badge}</span>}
                </Link>
              ))}
            </nav>

            {isAuthenticated && (
              <button className="logout-btn" onClick={handleLogout}>
                <LogOut size={20} />
                <span>Выйти</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        {isAuthenticated && user && (
          <div className="top-bar desktop-only">
            <div className="user-info">
              <span className="user-name">{user.first_name} {user.last_name}</span>
              <span className="user-type">{user.user_type === 'influencer' ? 'Инфлюенсер' : 'Игрок'}</span>
            </div>

            <div className="balance-container">
              <div className="balance-card">
                <span className="balance-label">Баланс</span>
                <span className="balance-value">
                  {user.user_type === 'influencer' ? '₽ 0.00' : '0 V-Coins'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="content-wrapper">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav mobile-only">
        {navigationItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${isActivePath(item.path) ? 'active' : ''}`}
          >
            <div className="nav-item-icon">
              <item.icon size={22} />
              {item.badge > 0 && <span className="badge">{item.badge}</span>}
            </div>
            <span className="nav-item-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
