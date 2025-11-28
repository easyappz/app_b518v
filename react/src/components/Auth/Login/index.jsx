import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import { login } from '../../../api/auth';
import { useAuthStore } from '../../../store/authStore';
import './styles.css';

const Login = () => {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Валидация
    if (!formData.username.trim()) {
      setError('Введите имя пользователя');
      setLoading(false);
      return;
    }

    if (!formData.password) {
      setError('Введите пароль');
      setLoading(false);
      return;
    }

    try {
      const userData = await login(formData.username, formData.password);
      setUser(userData);
      navigate('/home');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Неверное имя пользователя или пароль');
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

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">
                Имя пользователя
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Введите имя пользователя"
                value={formData.username}
                onChange={handleChange}
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Пароль
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Введите пароль"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              className="login-button"
            >
              Войти
            </Button>
          </form>

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
