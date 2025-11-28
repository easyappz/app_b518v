import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import { register } from '../../../api/auth';
import { useAuthStore } from '../../../store/authStore';
import './styles.css';

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstName: '',
    referralCode: ''
  });

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setFormData(prev => ({
        ...prev,
        referralCode: refCode
      }));
    }
  }, [searchParams]);

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

    if (formData.username.length < 3) {
      setError('Имя пользователя должно содержать минимум 3 символа');
      setLoading(false);
      return;
    }

    if (!formData.password) {
      setError('Введите пароль');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      setLoading(false);
      return;
    }

    try {
      const userData = await register(
        formData.username,
        formData.password,
        formData.firstName || null
      );
      setUser(userData);
      navigate('/home');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || 'Ошибка регистрации. Возможно, пользователь уже существует.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" data-easytag="id7-src/components/Auth/Register">
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
          <h1 className="auth-title">Регистрация</h1>
          <p className="auth-subtitle">Присоединяйтесь к Poker Chain</p>
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
                Имя пользователя *
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
                required
              />
              <p className="form-hint">Минимум 3 символа</p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Пароль *
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Введите пароль"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                autoComplete="new-password"
                required
              />
              <p className="form-hint">Минимум 6 символов</p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="firstName">
                Имя (опционально)
              </label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                placeholder="Введите ваше имя"
                value={formData.firstName}
                onChange={handleChange}
                disabled={loading}
                autoComplete="given-name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="referralCode">
                Реферальный код (опционально)
              </label>
              <Input
                id="referralCode"
                name="referralCode"
                type="text"
                placeholder="Введите код приглашения"
                value={formData.referralCode}
                onChange={handleChange}
                disabled={loading || searchParams.has('ref')}
              />
              {searchParams.has('ref') && (
                <p className="form-hint">
                  ✨ Код из реферальной ссылки
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              className="register-button"
            >
              Зарегистрироваться
            </Button>
          </form>

          <div className="auth-divider">
            <span>или</span>
          </div>

          <div className="auth-footer">
            <p className="auth-link-text">Уже есть аккаунт?</p>
            <button
              className="auth-link-button"
              onClick={() => navigate('/login')}
            >
              Войти
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Register;
