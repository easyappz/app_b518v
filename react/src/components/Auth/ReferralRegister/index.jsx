import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '../../common/Card';
import Button from '../../common/Button';
import { registerUser } from '../../../api/referrals';
import useAuthStore from '../../../store/authStore';
import './styles.css';

const ReferralRegister = () => {
  const navigate = useNavigate();
  const { referralCode } = useParams();
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referrerInfo, setReferrerInfo] = useState(null);

  useEffect(() => {
    // Mock referrer info - in real app, fetch from API
    if (referralCode) {
      setReferrerInfo({
        first_name: 'Иван',
        username: 'ivan_poker',
        referral_code: referralCode
      });
    }
  }, [referralCode]);

  const handleRegister = async () => {
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
        referrer_code: referralCode
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
    <div className="auth-container" data-easytag="id8-src/components/Auth/ReferralRegister">
      <div className="auth-background">
        <div className="neon-circle circle-1"></div>
        <div className="neon-circle circle-2"></div>
        <div className="neon-circle circle-3"></div>
      </div>

      <Card className="auth-card referral-card" glow>
        <div className="auth-header">
          <div className="auth-logo">
            <div className="logo-icon">🎁</div>
          </div>
          <h1 className="auth-title">Приглашение</h1>
          {referrerInfo ? (
            <div className="referrer-info">
              <p className="auth-subtitle">Вас пригласил</p>
              <div className="referrer-card">
                <div className="referrer-avatar">
                  {referrerInfo.first_name.charAt(0)}
                </div>
                <div className="referrer-details">
                  <p className="referrer-name">{referrerInfo.first_name}</p>
                  {referrerInfo.username && (
                    <p className="referrer-username">@{referrerInfo.username}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="auth-subtitle">Присоединяйтесь к Poker Chain</p>
          )}
        </div>

        <div className="auth-content">
          {error && (
            <div className="auth-error">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="referral-benefits">
            <h3 className="benefits-title">Что вы получите:</h3>
            <ul className="benefits-list">
              <li className="benefit-item">
                <span className="benefit-icon">💰</span>
                <span>Бонусы за приглашенных друзей</span>
              </li>
              <li className="benefit-item">
                <span className="benefit-icon">📊</span>
                <span>До 10 уровней реферальной сети</span>
              </li>
              <li className="benefit-item">
                <span className="benefit-icon">🎯</span>
                <span>Пассивный доход от активности рефералов</span>
              </li>
            </ul>
          </div>

          <Button
            variant="primary"
            fullWidth
            onClick={handleRegister}
            loading={loading}
            className="telegram-button"
          >
            <span className="telegram-icon">✈️</span>
            Присоединиться через Telegram
          </Button>

          <div className="referral-code-display">
            <span className="code-label">Реферальный код:</span>
            <span className="code-value">{referralCode}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ReferralRegister;
