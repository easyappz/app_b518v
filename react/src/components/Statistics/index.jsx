import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { TrendingUp, Users, Award, DollarSign, Calendar } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { getUserStatistics, getUserReferralsStats, getTransactionsForAnalytics } from '../../api/statistics';
import Layout from '../Layout';
import Card from '../common/Card';
import './styles.css';

const COLORS = ['#00ff88', '#00ddff', '#ff00ff', '#ffdd00', '#ff6b6b'];
const RANK_REQUIREMENTS = {
  standard: { next: 'silver', required: 5 },
  silver: { next: 'gold', required: 20 },
  gold: { next: 'platinum', required: 50 },
  platinum: { next: null, required: 0 }
};

const Statistics = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadStatistics();
  }, [isAuthenticated, user, period]);

  const loadStatistics = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [statsData, referralsData, transactionsData] = await Promise.all([
        getUserStatistics(user.id, period),
        getUserReferralsStats(user.id, 10),
        getTransactionsForAnalytics({
          date_from: getDateBefore(period),
          date_to: new Date().toISOString().split('T')[0]
        })
      ]);

      setStats(statsData);
      setReferrals(referralsData);
      setTransactions(transactionsData.results || []);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateBefore = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  };

  // Calculate income chart data
  const incomeChartData = useMemo(() => {
    if (!transactions.length) return [];

    const dailyIncome = {};
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Initialize all days with 0
    for (let i = 0; i < period; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dailyIncome[dateStr] = { vcoins: 0, rubles: 0, date: dateStr };
    }

    // Aggregate transactions by day
    transactions.forEach(tx => {
      if (tx.status !== 'completed') return;
      
      const date = tx.created_at.split('T')[0];
      if (dailyIncome[date]) {
        const amount = parseFloat(tx.amount);
        if (tx.currency_type === 'vcoins') {
          dailyIncome[date].vcoins += amount;
        } else {
          dailyIncome[date].rubles += amount;
        }
      }
    });

    return Object.values(dailyIncome).map(day => ({
      date: new Date(day.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      'V-Coins': Math.round(day.vcoins),
      'Рубли': Math.round(day.rubles)
    }));
  }, [transactions, period]);

  // Calculate bonus distribution
  const bonusDistribution = useMemo(() => {
    if (!transactions.length) return [];

    const distribution = {
      referral_bonus: { name: 'Прямые бонусы', value: 0 },
      tournament_bonus: { name: 'Глубинный кэшбэк', value: 0 },
      deposit_bonus: { name: '% с депозитов', value: 0 },
      tournament_reward: { name: 'Награды турниров', value: 0 }
    };

    transactions.forEach(tx => {
      if (tx.status === 'completed' && distribution[tx.transaction_type]) {
        distribution[tx.transaction_type].value += parseFloat(tx.amount);
      }
    });

    return Object.values(distribution)
      .filter(item => item.value > 0)
      .map(item => ({
        ...item,
        value: Math.round(item.value)
      }));
  }, [transactions]);

  // Calculate referrals by level
  const referralsByLevel = useMemo(() => {
    if (!referrals || !referrals.referrals) return [];

    const levels = Array(10).fill(0);
    
    const countReferrals = (refs, currentLevel = 1) => {
      if (currentLevel > 10) return;
      
      refs.forEach(ref => {
        levels[currentLevel - 1]++;
        if (ref.referrals && ref.referrals.length > 0) {
          countReferrals(ref.referrals, currentLevel + 1);
        }
      });
    };

    countReferrals(referrals.referrals);

    return levels.map((count, index) => ({
      level: `Ур. ${index + 1}`,
      count,
      fill: `hsl(${160 + index * 20}, 70%, ${50 - index * 3}%)`
    }));
  }, [referrals]);

  // Calculate top referrals
  const topReferrals = useMemo(() => {
    if (!referrals || !referrals.referrals) return [];

    const directReferrals = referrals.referrals.map(ref => {
      const refCount = countAllReferrals(ref.referrals || []);
      const income = calculateReferralIncome(ref.id);
      
      return {
        id: ref.id,
        name: ref.first_name + (ref.last_name ? ` ${ref.last_name}` : ''),
        username: ref.username,
        referralsCount: refCount,
        income
      };
    });

    return directReferrals
      .sort((a, b) => b.income - a.income)
      .slice(0, 5);
  }, [referrals, transactions]);

  const countAllReferrals = (refs) => {
    let count = refs.length;
    refs.forEach(ref => {
      if (ref.referrals && ref.referrals.length > 0) {
        count += countAllReferrals(ref.referrals);
      }
    });
    return count;
  };

  const calculateReferralIncome = (refId) => {
    return transactions
      .filter(tx => tx.related_user_id === refId && tx.status === 'completed')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
  };

  const activeReferralsCount = useMemo(() => {
    if (!referrals || !referrals.referrals) return 0;
    return referrals.referrals.length;
  }, [referrals]);

  const currentRank = user?.rank || 'standard';
  const rankInfo = RANK_REQUIREMENTS[currentRank];
  const rankProgress = rankInfo.next 
    ? Math.min((activeReferralsCount / rankInfo.required) * 100, 100)
    : 100;

  if (loading) {
    return (
      <Layout>
        <div className="statistics-loading">
          <div className="loading-spinner"></div>
          <p>Загрузка статистики...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="statistics-container" data-easytag="id13-src/components/Statistics">
        <div className="statistics-header">
          <h1>Статистика и аналитика</h1>
          <div className="period-selector">
            <button
              className={period === 7 ? 'active' : ''}
              onClick={() => setPeriod(7)}
            >
              7 дней
            </button>
            <button
              className={period === 30 ? 'active' : ''}
              onClick={() => setPeriod(30)}
            >
              30 дней
            </button>
            <button
              className={period === 90 ? 'active' : ''}
              onClick={() => setPeriod(90)}
            >
              90 дней
            </button>
          </div>
        </div>

        {/* Overall Stats Cards */}
        <div className="stats-cards-grid">
          <Card className="stat-card">
            <div className="stat-icon">
              <DollarSign size={32} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Всего заработано</p>
              <p className="stat-value">
                {user?.user_type === 'influencer' 
                  ? `${Math.round(stats?.total_earnings || 0)} ₽`
                  : `${Math.round(stats?.total_earnings || 0)} V-Coins`
                }
              </p>
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-icon">
              <Users size={32} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Всего рефералов</p>
              <p className="stat-value">{referrals?.total_referrals || 0}</p>
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-icon">
              <TrendingUp size={32} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Активных рефералов</p>
              <p className="stat-value">{activeReferralsCount}</p>
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-icon">
              <Award size={32} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Текущий ранг</p>
              <p className="stat-value rank-badge">
                {currentRank === 'standard' && 'Стандарт'}
                {currentRank === 'silver' && 'Серебро'}
                {currentRank === 'gold' && 'Золото'}
                {currentRank === 'platinum' && 'Платина'}
              </p>
            </div>
          </Card>
        </div>

        {/* Income Chart */}
        <Card className="chart-card">
          <div className="chart-header">
            <h2>График доходов</h2>
            <Calendar size={24} />
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={incomeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="date" 
                  stroke="#00ff88"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#00ff88"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    border: '1px solid #00ff88',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                {user?.user_type === 'player' ? (
                  <Line 
                    type="monotone" 
                    dataKey="V-Coins" 
                    stroke="#00ff88" 
                    strokeWidth={2}
                    dot={{ fill: '#00ff88', r: 4 }}
                  />
                ) : (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="V-Coins" 
                      stroke="#00ff88" 
                      strokeWidth={2}
                      dot={{ fill: '#00ff88', r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Рубли" 
                      stroke="#ff00ff" 
                      strokeWidth={2}
                      dot={{ fill: '#ff00ff', r: 4 }}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="charts-row">
          {/* Bonus Distribution */}
          <Card className="chart-card half">
            <h2>Распределение по типам бонусов</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={bonusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {bonusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                      border: '1px solid #00ff88',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Referrals by Level */}
          <Card className="chart-card half">
            <h2>Рефералы по уровням</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={referralsByLevel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="level" 
                    stroke="#00ff88"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#00ff88"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                      border: '1px solid #00ff88',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="count" fill="#00ff88">
                    {referralsByLevel.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Rank Progress */}
        <Card className="rank-progress-card">
          <h2>Прогресс ранга</h2>
          <div className="rank-progress-content">
            <div className="current-rank-info">
              <Award size={48} className="rank-icon" />
              <div>
                <p className="current-rank-label">Текущий ранг</p>
                <p className="current-rank-value">
                  {currentRank === 'standard' && 'Стандарт'}
                  {currentRank === 'silver' && 'Серебро'}
                  {currentRank === 'gold' && 'Золото'}
                  {currentRank === 'platinum' && 'Платина'}
                </p>
              </div>
            </div>
            
            {rankInfo.next && (
              <>
                <div className="rank-progress-bar">
                  <div 
                    className="rank-progress-fill" 
                    style={{ width: `${rankProgress}%` }}
                  >
                    <span className="rank-progress-text">{rankProgress.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="rank-next-info">
                  <p>До следующего ранга ({rankInfo.next === 'silver' ? 'Серебро' : rankInfo.next === 'gold' ? 'Золото' : 'Платина'}):</p>
                  <p className="rank-requirement">
                    Нужно активных рефералов: <strong>{rankInfo.required - activeReferralsCount}</strong> из {rankInfo.required}
                  </p>
                </div>
              </>
            )}
            
            {!rankInfo.next && (
              <div className="rank-max">
                <p>🎉 Вы достигли максимального ранга!</p>
              </div>
            )}
          </div>
        </Card>

        {/* Top Referrals */}
        <Card className="top-referrals-card">
          <h2>Топ рефералов</h2>
          <div className="top-referrals-list">
            {topReferrals.length > 0 ? (
              topReferrals.map((ref, index) => (
                <div key={ref.id} className="top-referral-item">
                  <div className="referral-rank">#{index + 1}</div>
                  <div className="referral-info">
                    <p className="referral-name">
                      {ref.name}
                      {ref.username && <span className="referral-username">@{ref.username}</span>}
                    </p>
                    <p className="referral-stats">
                      Рефералов: {ref.referralsCount}
                    </p>
                  </div>
                  <div className="referral-income">
                    {user?.user_type === 'influencer' 
                      ? `${Math.round(ref.income)} ₽`
                      : `${Math.round(ref.income)} V-Coins`
                    }
                  </div>
                </div>
              ))
            ) : (
              <p className="no-referrals">У вас пока нет прямых рефералов</p>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Statistics;
