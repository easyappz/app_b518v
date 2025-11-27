import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Share2, QrCode, TrendingUp, Users, Coins, Gift, ArrowRight } from 'lucide-react';
import useAuthStore from '../../../store/authStore';
import { getUserStats } from '../../../api/users';
import { getReferralLink, getUserReferrals } from '../../../api/referrals';
import { getTransactions } from '../../../api/transactions';
import './styles.css';

const PlayerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [referralData, setReferralData] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, linkData, referralsData, transactionsData] = await Promise.all([
        getUserStats(user.id),
        getReferralLink(user.id),
        getUserReferrals(user.id, 1),
        getTransactions({ page_size: 5 })
      ]);

      setStats(statsData);
      setReferralData(linkData);
      setReferrals(referralsData);
      setRecentTransactions(transactionsData.results || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (referralData?.referral_link) {
      navigator.clipboard.writeText(referralData.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareTelegram = () => {
    if (referralData?.referral_link) {
      const text = encodeURIComponent(`Присоединяйся к Poker Chain! Используй мою реферальную ссылку: ${referralData.referral_link}`);
      window.open(`https://t.me/share/url?url=${encodeURIComponent(referralData.referral_link)}&text=${text}`, '_blank');
    }
  };

  const getRankColor = (rank) => {
    const colors = {
      'Bronze': '#CD7F32',
      'Silver': '#C0C0C0',
      'Gold': '#FFD700',
      'Platinum': '#E5E4E2',
      'Diamond': '#B9F2FF'
    };
    return colors[rank] || '#6366f1';
  };

  const getActiveReferralsCount = () => {
    if (!referrals?.referrals) return 0;
    return referrals.referrals.filter(ref => ref.has_completed_first_tournament).length;
  };

  const formatAmount = (amount) => {
    return parseFloat(amount).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getTransactionTypeLabel = (type) => {
    const labels = {
      'referral_bonus': 'Реферальный бонус',
      'tournament_bonus': 'Бонус за турнир',
      'deposit_bonus': 'Бонус за депозит',
      'withdrawal': 'Вывод средств',
      'tournament_reward': 'Награда за турнир'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="player-dashboard loading" data-easytag="id9-src/components/Dashboard/PlayerDashboard">
        <div className="loading-spinner">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="player-dashboard" data-easytag="id9-src/components/Dashboard/PlayerDashboard">
      {/* Шапка профиля */}
      <div className="profile-header">
        <div className="profile-avatar">
          {user?.photo_url ? (
            <img src={user.photo_url} alt={user.first_name} />
          ) : (
            <div className="avatar-placeholder">
              {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
            </div>
          )}
        </div>
        <div className="profile-info">
          <h1 className="profile-name">{user?.first_name} {user?.last_name}</h1>
          <div className="profile-rank" style={{ color: getRankColor(stats?.rank) }}>
            <TrendingUp size={18} />
            <span>{stats?.rank || 'Bronze'}</span>
          </div>
        </div>
        <div className="rank-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '65%' }}></div>
          </div>
          <span className="progress-text">65% до следующего ранга</span>
        </div>
      </div>

      {/* Сетка карточек */}
      <div className="dashboard-grid">
        {/* Карточки баланса */}
        <div className="balance-cards">
          <div className="balance-card primary">
            <div className="card-icon">
              <Coins size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">V-Coins баланс</span>
              <span className="card-value animated-number">
                {stats?.balance ? formatAmount(stats.balance) : '0.00'}
              </span>
            </div>
          </div>

          <div className="balance-card secondary">
            <div className="card-icon">
              <Gift size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">Заработано всего</span>
              <span className="card-value animated-number">
                {stats?.total_earnings ? formatAmount(stats.total_earnings) : '0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Реферальный блок */}
        <div className="referral-block">
          <h2 className="block-title">Моя реферальная ссылка</h2>
          <div className="referral-link-container">
            <input
              type="text"
              className="referral-link-input"
              value={referralData?.referral_link || ''}
              readOnly
            />
            <button className="copy-btn" onClick={handleCopyLink}>
              <Copy size={18} />
              <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
            </button>
          </div>

          <div className="referral-actions">
            <div className="qr-code-placeholder">
              <QrCode size={80} />
              <span>QR-код</span>
            </div>
            <button className="share-telegram-btn" onClick={handleShareTelegram}>
              <Share2 size={18} />
              <span>Поделиться в Telegram</span>
            </button>
          </div>
        </div>

        {/* Статистика рефералов */}
        <div className="referral-stats">
          <h2 className="block-title">Статистика рефералов</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <Users size={24} />
              <div className="stat-content">
                <span className="stat-label">Всего рефералов</span>
                <span className="stat-value">{referrals?.total_referrals || 0}</span>
              </div>
            </div>
            <div className="stat-item">
              <TrendingUp size={24} />
              <div className="stat-content">
                <span className="stat-label">Активных</span>
                <span className="stat-value">{getActiveReferralsCount()}</span>
              </div>
            </div>
          </div>

          {referrals?.referrals && referrals.referrals.length > 0 && (
            <div className="referrals-by-level">
              <span className="mini-label">Рефералы по уровням:</span>
              <div className="level-graph">
                {referrals.referrals.slice(0, 3).map((ref, idx) => (
                  <div key={ref.id} className="level-bar" style={{ height: `${(idx + 1) * 30}px` }}>
                    <span>{ref.level || 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Последние начисления */}
        <div className="recent-transactions">
          <div className="transactions-header">
            <h2 className="block-title">Последние начисления</h2>
            <button className="view-all-link" onClick={() => navigate('/transactions')}>
              Смотреть все <ArrowRight size={16} />
            </button>
          </div>

          <div className="transactions-list">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((transaction) => (
                <div key={transaction.id} className="transaction-item">
                  <div className="transaction-icon">
                    <Gift size={18} />
                  </div>
                  <div className="transaction-info">
                    <span className="transaction-type">
                      {getTransactionTypeLabel(transaction.transaction_type)}
                    </span>
                    {transaction.related_user_name && (
                      <span className="transaction-user">{transaction.related_user_name}</span>
                    )}
                    <span className="transaction-date">
                      {new Date(transaction.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <div className="transaction-amount positive">
                    +{formatAmount(transaction.amount)} V
                  </div>
                </div>
              ))
            ) : (
              <div className="no-transactions">Пока нет начислений</div>
            )}
          </div>
        </div>

        {/* Быстрые действия */}
        <div className="quick-actions">
          <h2 className="block-title">Быстрые действия</h2>
          <div className="actions-grid">
            <button className="action-btn" onClick={() => navigate('/referral-tree')}>
              <Users size={24} />
              <span>Дерево рефералов</span>
            </button>
            <button className="action-btn" onClick={() => navigate('/transactions')}>
              <Coins size={24} />
              <span>История транзакций</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerDashboard;
