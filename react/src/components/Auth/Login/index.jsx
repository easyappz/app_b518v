import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../common/Card';
import Button from '../../common/Button';
import { loginWithTelegram } from '../../../api/auth';
import useAuthStore from '../../../store/authStore';
import './styles.css';

const Login = () => {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTelegramLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Mock Telegram data for demo
      const mockTelegramData = {
        telegram_id: Math.floor(Math.random() * 1000000000),
        username: 'demo_user',
        first_name: 'Demo',
        last_name: 'User',
        photo_url: null,
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'mock_hash_' + Math.random().toString(36).substring(7)
      };

      const userData = await loginWithTelegram(mockTelegramData);
      setUser(userData);
      navigate('/home');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" data-easytag="id6-src/components/Auth/Login">
      <div className="auth-background">
        <div className="neon-circle circle-1"></div>
        <div className="neon-circle circle-2"></div>
        <div className="neon-circle circle-3"></div>
      </div>

      <Card className="auth-card" glow>
        <div className="auth-header">
          <div className="auth-logo">
            <div className="logo-icon">♠️</div>
          </div>
          <h1 className="auth-title">Вход в Poker Chain</h1>
          <p className="auth-subtitle">Реферальная система нового поколения</p>
        </div>

        <div className="auth-content">
          {error && (
            <div className="auth-error">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <Button
            variant="primary"
            fullWidth
            onClick={handleTelegramLogin}
            loading={loading}
            className="telegram-button"
          >
            <span className="telegram-icon">✈️</span>
            Войти через Telegram
          </Button>

          <div className="auth-divider">
            <span>или</span>
          </div>

          <div className="auth-footer">
            <p className="auth-link-text">Нет аккаунта?</p>
            <button
              className="auth-link-button"
              onClick={() => navigate('/register')}
            >
              Зарегистрируйтесь
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;
