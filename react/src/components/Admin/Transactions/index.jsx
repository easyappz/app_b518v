import React, { useEffect, useState } from 'react';
import { getTransactions } from '../../../api/admin';
import './styles.css';

const AdminTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null });
  const [filters, setFilters] = useState({
    user_id: '',
    transaction_type: '',
    currency: '',
    date_from: '',
    date_to: '',
    page: 1,
    page_size: 20
  });

  useEffect(() => {
    loadTransactions();
  }, [filters]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      const data = await getTransactions(cleanFilters);
      setTransactions(data.results || []);
      setPagination({
        count: data.count,
        next: data.next,
        previous: data.previous
      });
    } catch (err) {
      setError(err.message || 'Ошибка загрузки транзакций');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const totalPages = Math.ceil(pagination.count / filters.page_size);

  return (
    <div className="admin-transactions">
      <div className="admin-header">
        <h1>Транзакции</h1>
        <p>Все транзакции в системе</p>
      </div>

      <div className="filters-panel">
        <div className="filter-group">
          <label>Тип транзакции</label>
          <select
            value={filters.transaction_type}
            onChange={(e) => handleFilterChange('transaction_type', e.target.value)}
            className="filter-select"
          >
            <option value="">Все</option>
            <option value="referral_bonus">Реферальный бонус</option>
            <option value="tournament_bonus">Бонус за турнир</option>
            <option value="deposit_bonus">Бонус за депозит</option>
            <option value="withdrawal">Вывод</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Валюта</label>
          <select
            value={filters.currency}
            onChange={(e) => handleFilterChange('currency', e.target.value)}
            className="filter-select"
          >
            <option value="">Все</option>
            <option value="v_coins">V-Coins</option>
            <option value="cash">Деньги (₽)</option>
          </select>
        </div>

        <div className="filter-group">
          <label>От даты</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label>До даты</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
            className="filter-input"
          />
        </div>

        <button onClick={loadTransactions} className="filter-refresh">
          🔄 Обновить
        </button>
      </div>

      {loading && <div className="loading">Загрузка транзакций...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="table-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Пользователь</th>
                  <th>Тип</th>
                  <th>Сумма</th>
                  <th>Валюта</th>
                  <th>Описание</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((trans) => (
                  <tr key={trans.id}>
                    <td>{trans.id}</td>
                    <td>
                      <div className="user-cell">
                        <div>{trans.user.first_name}</div>
                        {trans.user.username && <div className="username">@{trans.user.username}</div>}
                      </div>
                    </td>
                    <td>
                      <span className={`trans-type-badge ${trans.transaction_type}`}>
                        {trans.transaction_type === 'referral_bonus' && 'Реферальный'}
                        {trans.transaction_type === 'tournament_bonus' && 'Турнир'}
                        {trans.transaction_type === 'deposit_bonus' && 'Депозит'}
                        {trans.transaction_type === 'withdrawal' && 'Вывод'}
                      </span>
                    </td>
                    <td>
                      <span className={`amount ${trans.amount > 0 ? 'positive' : 'negative'}`}>
                        {trans.amount > 0 ? '+' : ''}{trans.amount.toLocaleString('ru-RU')}
                      </span>
                    </td>
                    <td>
                      <span className={`currency-badge ${trans.currency}`}>
                        {trans.currency === 'v_coins' ? 'V-Coins' : '₽'}
                      </span>
                    </td>
                    <td>{trans.description}</td>
                    <td>{new Date(trans.created_at).toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(filters.page - 1)}
                disabled={!pagination.previous}
                className="pagination-btn"
              >
                ← Назад
              </button>
              <span className="pagination-info">
                Страница {filters.page} из {totalPages} (всего {pagination.count})
              </span>
              <button
                onClick={() => handlePageChange(filters.page + 1)}
                disabled={!pagination.next}
                className="pagination-btn"
              >
                Вперед →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminTransactions;
