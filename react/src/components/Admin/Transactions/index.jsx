import React, { useState, useEffect } from 'react';
import { getTransactions } from '../../../api/admin';
import './styles.css';

const AdminTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null
  });
  
  const [filters, setFilters] = useState({
    user_id: '',
    transaction_type: '',
    currency: '',
    date_from: '',
    date_to: '',
    page: 1,
    page_size: 20
  });

  const [sortConfig, setSortConfig] = useState({
    key: 'created_at',
    direction: 'desc'
  });

  useEffect(() => {
    fetchTransactions();
  }, [filters.page]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.transaction_type) params.transaction_type = filters.transaction_type;
      if (filters.currency) params.currency = filters.currency;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      params.page = filters.page;
      params.page_size = filters.page_size;

      const data = await getTransactions(params);
      setTransactions(data.results || []);
      setPagination({
        count: data.count,
        next: data.next,
        previous: data.previous
      });
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Ошибка загрузки транзакций');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
      page: 1
    }));
  };

  const handleApplyFilters = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
    fetchTransactions();
  };

  const handleResetFilters = () => {
    setFilters({
      user_id: '',
      transaction_type: '',
      currency: '',
      date_from: '',
      date_to: '',
      page: 1,
      page_size: 20
    });
    setTimeout(() => fetchTransactions(), 0);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sorted = [...transactions].sort((a, b) => {
      let aValue = a[key];
      let bValue = b[key];

      if (key === 'user') {
        aValue = a.user?.first_name || '';
        bValue = b.user?.first_name || '';
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setTransactions(sorted);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Пользователь', 'Тип', 'Сумма', 'Валюта', 'Описание', 'Дата'];
    const rows = transactions.map(t => [
      t.id,
      `${t.user?.first_name || ''} ${t.user?.username ? `(@${t.user.username})` : ''}`.trim(),
      getTransactionTypeLabel(t.transaction_type),
      t.amount,
      getCurrencyLabel(t.currency),
      t.description || '',
      new Date(t.created_at).toLocaleString('ru-RU')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getTransactionTypeLabel = (type) => {
    const labels = {
      referral_bonus: 'Реферальный бонус',
      tournament_bonus: 'Бонус за турнир',
      deposit_bonus: 'Бонус за депозит',
      withdrawal: 'Вывод средств'
    };
    return labels[type] || type;
  };

  const getCurrencyLabel = (currency) => {
    const labels = {
      v_coins: 'V-Coins',
      cash: 'Рубли'
    };
    return labels[currency] || currency;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(pagination.count / filters.page_size);

  return (
    <div data-easytag="id18-src/components/Admin/Transactions" className="admin-transactions">
      <div className="admin-header">
        <h1>Транзакции</h1>
        <p>Все транзакции системы</p>
      </div>

      <div className="transactions-filters">
        <div className="filters-row">
          <div className="filter-group">
            <label>ID пользователя</label>
            <input
              type="number"
              name="user_id"
              value={filters.user_id}
              onChange={handleFilterChange}
              placeholder="ID"
            />
          </div>

          <div className="filter-group">
            <label>Тип транзакции</label>
            <select
              name="transaction_type"
              value={filters.transaction_type}
              onChange={handleFilterChange}
            >
              <option value="">Все типы</option>
              <option value="referral_bonus">Реферальный бонус</option>
              <option value="tournament_bonus">Бонус за турнир</option>
              <option value="deposit_bonus">Бонус за депозит</option>
              <option value="withdrawal">Вывод средств</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Валюта</label>
            <select
              name="currency"
              value={filters.currency}
              onChange={handleFilterChange}
            >
              <option value="">Все валюты</option>
              <option value="v_coins">V-Coins</option>
              <option value="cash">Рубли</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Дата от</label>
            <input
              type="date"
              name="date_from"
              value={filters.date_from}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label>Дата до</label>
            <input
              type="date"
              name="date_to"
              value={filters.date_to}
              onChange={handleFilterChange}
            />
          </div>
        </div>

        <div className="filters-actions">
          <button className="btn-apply" onClick={handleApplyFilters}>
            Применить
          </button>
          <button className="btn-reset" onClick={handleResetFilters}>
            Сбросить
          </button>
          <button className="btn-export" onClick={handleExportCSV}>
            Экспорт CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Загрузка транзакций...</p>
        </div>
      ) : (
        <>
          <div className="transactions-table-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('id')}>
                    ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('user')}>
                    Пользователь {sortConfig.key === 'user' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('transaction_type')}>
                    Тип {sortConfig.key === 'transaction_type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('amount')}>
                    Сумма {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('currency')}>
                    Валюта {sortConfig.key === 'currency' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Описание</th>
                  <th onClick={() => handleSort('created_at')}>
                    Дата {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      Транзакции не найдены
                    </td>
                  </tr>
                ) : (
                  transactions.map(transaction => (
                    <tr key={transaction.id}>
                      <td>#{transaction.id}</td>
                      <td>
                        <div className="user-cell">
                          <div className="user-name">
                            {transaction.user?.first_name || 'N/A'}
                          </div>
                          {transaction.user?.username && (
                            <div className="user-username">@{transaction.user.username}</div>
                          )}
                          <div className="user-id">ID: {transaction.user?.id}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`type-badge type-${transaction.transaction_type}`}>
                          {getTransactionTypeLabel(transaction.transaction_type)}
                        </span>
                      </td>
                      <td className="amount-cell">
                        {parseFloat(transaction.amount).toLocaleString('ru-RU', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td>
                        <span className={`currency-badge currency-${transaction.currency}`}>
                          {getCurrencyLabel(transaction.currency)}
                        </span>
                      </td>
                      <td className="description-cell">
                        {transaction.description || '—'}
                      </td>
                      <td className="date-cell">
                        {formatDate(transaction.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.count > 0 && (
            <div className="pagination">
              <div className="pagination-info">
                Показано {(filters.page - 1) * filters.page_size + 1}-
                {Math.min(filters.page * filters.page_size, pagination.count)} из {pagination.count}
              </div>
              <div className="pagination-controls">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={!pagination.previous}
                  className="btn-page"
                >
                  ← Назад
                </button>
                <span className="page-number">
                  Страница {filters.page} из {totalPages}
                </span>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={!pagination.next}
                  className="btn-page"
                >
                  Вперёд →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminTransactions;
