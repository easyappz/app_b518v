import React, { useEffect, useState } from 'react';
import { getStats, getAnalytics } from '../../../api/admin';
import './styles.css';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, analyticsData] = await Promise.all([
        getStats(),
        getAnalytics({ period: '30days' })
      ]);
      setStats(statsData);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div data-easytag="id15-src/components/Admin/Dashboard" className="admin-dashboard">
        <div className="loading">Загрузка статистики...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-easytag="id15-src/components/Admin/Dashboard" className="admin-dashboard">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div data-easytag="id15-src/components/Admin/Dashboard" className="admin-dashboard">
      <div className="admin-header">
        <h1>Дашборд</h1>
        <p>Общая статистика системы</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-label">Всего пользователей</div>
            <div className="stat-value">{stats?.total_users || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎮</div>
          <div className="stat-content">
            <div className="stat-label">Игроков</div>
            <div className="stat-value">{stats?.total_players || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <div className="stat-label">Инфлюенсеров</div>
            <div className="stat-value">{stats?.total_influencers || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💎</div>
          <div className="stat-content">
            <div className="stat-label">V-Coins в системе</div>
            <div className="stat-value">{(stats?.total_v_coins || 0).toLocaleString('ru-RU')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <div className="stat-label">Сумма выплат</div>
            <div className="stat-value">{(stats?.total_cash_payouts || 0).toLocaleString('ru-RU')} ₽</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-label">Ожидающих вывода</div>
            <div className="stat-value">{stats?.pending_withdrawals || 0}</div>
            <div className="stat-sub">на сумму {(stats?.pending_withdrawals_amount || 0).toLocaleString('ru-RU')} ₽</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Регистрации за 30 дней</h3>
          <div className="chart-container">
            {analytics?.registrations_by_day?.length > 0 ? (
              <div className="bar-chart">
                {analytics.registrations_by_day.map((item, index) => (
                  <div key={index} className="bar-item">
                    <div className="bar" style={{ height: `${Math.min((item.count / Math.max(...analytics.registrations_by_day.map(d => d.count))) * 100, 100)}%` }}>
                      <span className="bar-value">{item.count}</span>
                    </div>
                    <div className="bar-label">{new Date(item.date).getDate()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">Нет данных</div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3>Топ-10 рефереров</h3>
          <div className="top-referrers">
            {analytics?.top_referrers?.length > 0 ? (
              <table className="referrers-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Пользователь</th>
                    <th>Тип</th>
                    <th>Рефералов</th>
                    <th>Заработано</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.top_referrers.slice(0, 10).map((ref, index) => (
                    <tr key={ref.user_id}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="user-cell">
                          <div className="user-name">{ref.first_name}</div>
                          {ref.username && <div className="user-username">@{ref.username}</div>}
                        </div>
                      </td>
                      <td>
                        <span className={`user-type-badge ${ref.user_type}`}>
                          {ref.user_type === 'influencer' ? 'Инфлюенсер' : 'Игрок'}
                        </span>
                      </td>
                      <td>{ref.referrals_count}</td>
                      <td>{ref.total_earnings.toLocaleString('ru-RU')} {ref.user_type === 'influencer' ? '₽' : 'V'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">Нет данных</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
