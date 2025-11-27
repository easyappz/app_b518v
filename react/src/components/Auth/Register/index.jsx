import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../../common/Card';
import Button from '../../common/Button';
import Input from '../../common/Input';
import { registerUser } from '../../../api/referrals';
import useAuthStore from '../../../store/authStore';
import './styles.css';

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
    }
  }, [searchParams]);

  const handleTelegramRegister = async () => {
    setLoading(true);
    setError('');

    try {
      // Mock Telegram data for demo
      const mockTelegramData = {
        telegram_id: Math.floor(Math.random() * 1000000000),
        username: 'new_user_' + Math.random().toString(36).substring(7),
        first_name: 'Новый',
        last_name: 'Пользователь',
        photo_url: null,
        referrer_code: referralCode || null
      };

      const userData = await registerUser(mockTelegramData);
      setUser(userData);
      navigate('/home');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || 'Ошибка регистрации');
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

          <div className="form-group">
            <label className="form-label">
              Реферальный код (опционально)
            </label>
            <Input
              type="text"
              placeholder="Введите код приглашения"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              disabled={searchParams.has('ref')}
            />
            {searchParams.has('ref') && (
              <p className="form-hint">
                ✨ Код из реферальной ссылки
              </p>
            )}
          </div>

          <Button
            variant="primary"
            fullWidth
            onClick={handleTelegramRegister}
            loading={loading}
            className="telegram-button"
          >
            <span className="telegram-icon">✈️</span>
            Зарегистрироваться через Telegram
          </Button>

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
