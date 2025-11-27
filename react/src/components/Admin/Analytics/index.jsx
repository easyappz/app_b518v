import React, { useState, useEffect } from 'react';
import { getAnalytics } from '../../../api/admin';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './styles.css';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30days');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAnalytics({ period });
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Ошибка загрузки аналитики');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const COLORS = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c'];

  if (loading) {
    return (
      <div data-easytag="id20-src/components/Admin/Analytics" className="analytics-loading">
        <div className="spinner"></div>
        <p>Загрузка аналитики...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div data-easytag="id20-src/components/Admin/Analytics" className="analytics-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div data-easytag="id20-src/components/Admin/Analytics" className="admin-analytics">
      <div className="admin-header">
        <div>
          <h1>Аналитика</h1>
          <p>Статистика и аналитика системы</p>
        </div>
        <div className="period-selector">
          <label>Период:</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="7days">7 дней</option>
            <option value="30days">30 дней</option>
            <option value="90days">90 дней</option>
            <option value="1year">1 год</option>
          </select>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card chart-card">
          <h3>Регистрации по дням</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics?.registrations_by_day || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                labelFormatter={formatDate}
                contentStyle={{ 
                  background: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#3498db" 
                strokeWidth={2}
                name="Регистрации"
                dot={{ fill: '#3498db', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="analytics-card chart-card">
          <h3>Активность по дням</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics?.activity_by_day || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                yAxisId="left"
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                labelFormatter={formatDate}
                contentStyle={{ 
                  background: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="transactions_count" 
                stroke="#2ecc71" 
                strokeWidth={2}
                name="Транзакции"
                dot={{ fill: '#2ecc71', r: 4 }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="total_amount" 
                stroke="#f39c12" 
                strokeWidth={2}
                name="Сумма (₽)"
                dot={{ fill: '#f39c12', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="analytics-card">
        <h3>Топ-20 рефереров</h3>
        <div className="top-referrers-table-container">
          <table className="top-referrers-table">
            <thead>
              <tr>
                <th>Место</th>
                <th>Пользователь</th>
                <th>Тип</th>
                <th>Рефералов</th>
                <th>Заработано</th>
              </tr>
            </thead>
            <tbody>
              {analytics?.top_referrers && analytics.top_referrers.length > 0 ? (
                analytics.top_referrers.slice(0, 20).map((referrer, index) => (
                  <tr key={referrer.user_id}>
                    <td className="rank-cell">
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && `${index + 1}`}
                    </td>
                    <td>
                      <div className="user-info">
                        <div className="user-name">{referrer.first_name}</div>
                        {referrer.username && (
                          <div className="user-username">@{referrer.username}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`user-type-badge ${referrer.user_type}`}>
                        {referrer.user_type === 'influencer' ? '⭐ Инфлюенсер' : '👤 Игрок'}
                      </span>
                    </td>
                    <td className="count-cell">{referrer.referrals_count}</td>
                    <td className="earnings-cell">
                      {parseFloat(referrer.total_earnings).toLocaleString('ru-RU', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} ₽
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="no-data">Нет данных</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
