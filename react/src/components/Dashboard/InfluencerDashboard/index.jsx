import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Share2, QrCode, TrendingUp, Users, Coins, Gift, ArrowRight, DollarSign, Award, BarChart3, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useAuthStore from '../../../store/authStore';
import { getUserStats } from '../../../api/users';
import { getReferralLink, getUserReferrals } from '../../../api/referrals';
import { getTransactions } from '../../../api/transactions';
import { getWithdrawals } from '../../../api/withdrawals';
import './styles.css';

const InfluencerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [referralData, setReferralData] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [incomeChart, setIncomeChart] = useState([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, linkData, referralsData, transactionsData, withdrawalsData] = await Promise.all([
        getUserStats(user.id),
        getReferralLink(user.id),
        getUserReferrals(user.id, 10),
        getTransactions({ page_size: 10, currency_type: 'rubles' }),
        getWithdrawals({ page_size: 5 })
      ]);

      setStats(statsData);
      setReferralData(linkData);
      setReferrals(referralsData);
      setRecentTransactions(transactionsData.results || []);
      setWithdrawals(withdrawalsData.results || []);
      
      generateIncomeChart(transactionsData.results || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateIncomeChart = (transactions) => {
    const last30Days = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayTransactions = transactions.filter(t => {
        const tDate = new Date(t.created_at).toISOString().split('T')[0];
        return tDate === dateStr && t.transaction_type === 'deposit_bonus';
      });
      
      const dayIncome = dayTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      last30Days.push({
        date: date.getDate() + '.' + (date.getMonth() + 1),
        income: dayIncome
      });
    }
    
    setIncomeChart(last30Days);
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

  const getReferralsByLevel = () => {
    if (!referrals?.referrals) return {};
    
    const byLevel = {};
    for (let i = 1; i <= 10; i++) {
      byLevel[i] = 0;
    }
    
    const countReferrals = (refs, level = 1) => {
      refs.forEach(ref => {
        if (level <= 10) {
          byLevel[level]++;
          if (ref.referrals && ref.referrals.length > 0) {
            countReferrals(ref.referrals, level + 1);
          }
        }
      });
    };
    
    countReferrals(referrals.referrals);
    return byLevel;
  };

  const getConversionRate = () => {
    if (!referrals?.total_referrals || referrals.total_referrals === 0) return 0;
    const active = referrals.referrals.filter(ref => ref.has_completed_first_tournament).length;
    return ((active / referrals.total_referrals) * 100).toFixed(1);
  };

  const getAverageIncomePerReferral = () => {
    if (!stats?.total_earnings || !referrals?.total_referrals || referrals.total_referrals === 0) return 0;
    return (stats.total_earnings / referrals.total_referrals).toFixed(2);
  };

  const getDepositIncome = () => {
    return recentTransactions
      .filter(t => t.transaction_type === 'deposit_bonus')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  };

  const getAvailableForWithdrawal = () => {
    return stats?.balance || 0;
  };

  const formatAmount = (amount) => {
    return parseFloat(amount).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getTransactionTypeLabel = (type) => {
    const labels = {
      'referral_bonus': 'Прямой бонус',
      'tournament_bonus': 'Глубинный кэшбэк',
      'deposit_bonus': '10% с депозита',
      'withdrawal': 'Вывод средств',
      'tournament_reward': 'Награда за турнир'
    };
    return labels[type] || type;
  };

  const getWithdrawalStatusLabel = (status) => {
    const labels = {
      'pending': 'Ожидает',
      'processing': 'Обрабатывается',
      'completed': 'Завершено',
      'rejected': 'Отклонено'
    };
    return labels[status] || status;
  };

  const getWithdrawalStatusColor = (status) => {
    const colors = {
      'pending': '#f59e0b',
      'processing': '#3b82f6',
      'completed': '#10b981',
      'rejected': '#ef4444'
    };
    return colors[status] || '#6366f1';
  };

  if (loading) {
    return (
      <div className="influencer-dashboard loading" data-easytag="id10-src/components/Dashboard/InfluencerDashboard">
        <div className="loading-spinner">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="influencer-dashboard" data-easytag="id10-src/components/Dashboard/InfluencerDashboard">
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
          <div className="influencer-badge">Инфлюенсер</div>
          <h1 className="profile-name">{user?.first_name} {user?.last_name}</h1>
          <div className="profile-rank" style={{ color: getRankColor(stats?.rank) }}>
            <Award size={18} />
            <span>{stats?.rank || 'Gold'}</span>
          </div>
        </div>
      </div>

      {/* Сетка дашборда */}
      <div className="dashboard-grid">
        {/* Карточки баланса - две валюты */}
        <div className="balance-cards-dual">
          <div className="balance-card vcoins">
            <div className="card-icon">
              <Coins size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">V-Coins баланс</span>
              <span className="card-value">
                {stats?.balance ? formatAmount(stats.balance) : '0.00'}
              </span>
            </div>
          </div>

          <div className="balance-card rubles">
            <div className="card-icon">
              <DollarSign size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">Реальный баланс</span>
              <span className="card-value">
                {stats?.balance ? formatAmount(stats.balance) : '0.00'} ₽
              </span>
            </div>
          </div>

          <div className="balance-card available">
            <div className="card-icon">
              <Download size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">Доступно к выводу</span>
              <span className="card-value">
                {formatAmount(getAvailableForWithdrawal())} ₽
              </span>
              <button className="withdraw-btn" onClick={() => setShowWithdrawalModal(true)}>
                Вывести средства
              </button>
            </div>
          </div>
        </div>

        {/* Доход с депозитов */}
        <div className="deposit-income-block">
          <h2 className="block-title">Доход с депозитов (10%)</h2>
          <div className="income-summary">
            <div className="income-total">
              <span className="income-label">Заработано с комиссии:</span>
              <span className="income-value">{formatAmount(getDepositIncome())} ₽</span>
            </div>
          </div>
          <div className="income-chart">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={incomeChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  formatter={(value) => [`${formatAmount(value)} ₽`, 'Доход']}
                />
                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
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

        {/* Расширенная статистика */}
        <div className="extended-stats">
          <h2 className="block-title">Расширенная статистика</h2>
          
          <div className="stats-summary">
            <div className="stat-card">
              <div className="stat-icon">
                <Users size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Всего рефералов</span>
                <span className="stat-number">{referrals?.total_referrals || 0}</span>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">
                <TrendingUp size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Конверсия</span>
                <span className="stat-number">{getConversionRate()}%</span>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">
                <BarChart3 size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Средний доход/реферал</span>
                <span className="stat-number">{getAverageIncomePerReferral()} ₽</span>
              </div>
            </div>
          </div>

          <div className="referrals-by-level">
            <span className="mini-label">Рефералы по уровням (1-10):</span>
            <div className="level-bars">
              {Object.entries(getReferralsByLevel()).map(([level, count]) => (
                <div key={level} className="level-bar-item">
                  <span className="level-number">Ур. {level}</span>
                  <div className="level-bar-container">
                    <div 
                      className="level-bar-fill" 
                      style={{ 
                        width: `${count > 0 ? (count / Math.max(...Object.values(getReferralsByLevel()))) * 100 : 0}%`,
                        minWidth: count > 0 ? '20px' : '0'
                      }}
                    >
                      <span className="level-count">{count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                      <span className="transaction-user">От: {transaction.related_user_name}</span>
                    )}
                    {transaction.referral_level && (
                      <span className="transaction-level">Уровень {transaction.referral_level}</span>
                    )}
                    <span className="transaction-date">
                      {new Date(transaction.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <div className="transaction-amount positive">
                    +{formatAmount(transaction.amount)} ₽
                  </div>
                </div>
              ))
            ) : (
              <div className="no-transactions">Пока нет начислений</div>
            )}
          </div>
        </div>

        {/* Заявки на вывод */}
        <div className="withdrawal-requests">
          <div className="transactions-header">
            <h2 className="block-title">Заявки на вывод</h2>
            <button className="view-all-link" onClick={() => navigate('/withdrawals')}>
              Полный список <ArrowRight size={16} />
            </button>
          </div>

          <div className="withdrawals-list">
            {withdrawals.length > 0 ? (
              withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="withdrawal-item">
                  <div className="withdrawal-info">
                    <span className="withdrawal-amount">{formatAmount(withdrawal.amount)} ₽</span>
                    <span className="withdrawal-method">{withdrawal.method === 'card' ? 'Карта' : 'Крипто'}</span>
                    <span className="withdrawal-date">
                      {new Date(withdrawal.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <div 
                    className="withdrawal-status" 
                    style={{ color: getWithdrawalStatusColor(withdrawal.status) }}
                  >
                    {getWithdrawalStatusLabel(withdrawal.status)}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-withdrawals">Нет заявок на вывод</div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно вывода */}
      {showWithdrawalModal && (
        <WithdrawalModal 
          onClose={() => setShowWithdrawalModal(false)} 
          availableBalance={getAvailableForWithdrawal()}
          onSuccess={fetchDashboardData}
        />
      )}
    </div>
  );
};

const WithdrawalModal = ({ onClose, availableBalance, onSuccess }) => {
  const [formData, setFormData] = useState({
    amount: '',
    method: 'card',
    wallet_address: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Введите корректную сумму');
      return;
    }

    if (parseFloat(formData.amount) > availableBalance) {
      setError('Недостаточно средств');
      return;
    }

    if (!formData.wallet_address) {
      setError('Введите реквизиты');
      return;
    }

    try {
      setLoading(true);
      const { createWithdrawal } = await import('../../../api/withdrawals');
      await createWithdrawal(formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при создании заявки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Вывод средств</h2>
        
        <div className="modal-balance">
          Доступно: {availableBalance.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
        </div>

        <form onSubmit={handleSubmit} className="withdrawal-form">
          <div className="form-group">
            <label>Сумма (₽)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="Введите сумму"
              required
            />
          </div>

          <div className="form-group">
            <label>Метод вывода</label>
            <select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
            >
              <option value="card">Банковская карта</option>
              <option value="crypto">Криптовалюта</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              {formData.method === 'card' ? 'Номер карты' : 'Адрес кошелька'}
            </label>
            <input
              type="text"
              value={formData.wallet_address}
              onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
              placeholder={formData.method === 'card' ? '1234 5678 9012 3456' : 'Введите адрес кошелька'}
              required
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Отмена
            </button>
            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Отправка...' : 'Подтвердить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InfluencerDashboard;
