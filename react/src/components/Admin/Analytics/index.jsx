import React, { useEffect, useState } from 'react';
import { getAnalytics } from '../../../api/admin';
import './styles.css';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30days');

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAnalytics({ period });
      setAnalytics(data);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки аналитики');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-analytics">
        <div className="loading">Загрузка аналитики...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-analytics">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="admin-analytics">
      <div className="admin-header">
        <h1>Аналитика</h1>
        <p>Детальная статистика активности системы</p>
      </div>

      <div className="period-selector">
        <button
          className={period === '7days' ? 'active' : ''}
          onClick={() => setPeriod('7days')}
        >
          7 дней
        </button>
        <button
          className={period === '30days' ? 'active' : ''}
          onClick={() => setPeriod('30days')}
        >
          30 дней
        </button>
        <button
          className={period === '90days' ? 'active' : ''}
          onClick={() => setPeriod('90days')}
        >
          90 дней
        </button>
        <button
          className={period === '1year' ? 'active' : ''}
          onClick={() => setPeriod('1year')}
        >
          1 год
        </button>
      </div>

      <div className="charts-section">
        <div className="chart-card">
          <h3>Регистрации по дням</h3>
          <div className="chart-container">
            {analytics?.registrations_by_day?.length > 0 ? (
              <div className="bar-chart">
                {analytics.registrations_by_day.map((item, index) => (
                  <div key={index} className="bar-item">
                    <div
                      className="bar"
                      style={{
                        height: `${Math.min(
                          (item.count / Math.max(...analytics.registrations_by_day.map(d => d.count))) * 100,
                          100
                        )}%`
                      }}
                    >
                      <span className="bar-value">{item.count}</span>
                    </div>
                    <div className="bar-label">{new Date(item.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">Нет данных</div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3>Активность по дням</h3>
          <div className="chart-container">
            {analytics?.activity_by_day?.length > 0 ? (
              <div className="activity-list">
                {analytics.activity_by_day.map((item, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-date">{new Date(item.date).toLocaleDateString('ru-RU')}</div>
                    <div className="activity-stats">
                      <div className="activity-stat">
                        <span className="stat-label">Транзакции:</span>
                        <span className="stat-value">{item.transactions_count}</span>
                      </div>
                      <div className="activity-stat">
                        <span className="stat-label">Сумма:</span>
                        <span className="stat-value">{item.total_amount.toLocaleString('ru-RU')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">Нет данных</div>
            )}
          </div>
        </div>

        <div className="chart-card full-width">
          <h3>Топ рефереров за период</h3>
          {analytics?.top_referrers?.length > 0 ? (
            <table className="top-table">
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
                {analytics.top_referrers.map((ref, index) => (
                  <tr key={ref.user_id}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="user-info">
                        <div className="user-name">{ref.first_name}</div>
                        {ref.username && <div className="user-username">@{ref.username}</div>}
                      </div>
                    </td>
                    <td>
                      <span className={`type-badge ${ref.user_type}`}>
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
  );
};

export default Analytics;
