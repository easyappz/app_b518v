import React, { useState, useEffect } from 'react';
import { getTransactions } from '../../api/transactions';
import './styles.css';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    currencyType: 'all',
    transactionType: 'all',
    period: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    hasMore: false,
    total: 0
  });
  const [totals, setTotals] = useState({
    vcoins: 0,
    rubles: 0
  });

  const transactionTypeLabels = {
    referral_bonus: 'Реферальный бонус',
    tournament_bonus: 'Глубинный кэшбэк',
    deposit_bonus: '% с депозита',
    withdrawal: 'Вывод',
    tournament_reward: 'Награда турнира'
  };

  const currencyLabels = {
    vcoins: 'V-Coins',
    rubles: '₽'
  };

  useEffect(() => {
    loadTransactions(true);
  }, [filters.currencyType, filters.transactionType, filters.dateFrom, filters.dateTo]);

  const loadTransactions = async (reset = false) => {
    setLoading(true);
    try {
      const params = {
        page: reset ? 1 : pagination.page,
        page_size: 20
      };

      if (filters.currencyType !== 'all') {
        params.currency_type = filters.currencyType;
      }

      if (filters.transactionType !== 'all') {
        params.transaction_type = filters.transactionType;
      }

      if (filters.dateFrom) {
        params.date_from = filters.dateFrom;
      }

      if (filters.dateTo) {
        params.date_to = filters.dateTo;
      }

      const data = await getTransactions(params);

      if (reset) {
        setTransactions(data.results);
      } else {
        setTransactions(prev => [...prev, ...data.results]);
      }

      setPagination({
        page: reset ? 2 : pagination.page + 1,
        hasMore: !!data.next,
        total: data.count
      });

      calculateTotals(reset ? data.results : [...transactions, ...data.results]);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (transactionsList) => {
    const totals = transactionsList.reduce((acc, transaction) => {
      const amount = parseFloat(transaction.amount);
      if (transaction.currency_type === 'vcoins') {
        acc.vcoins += amount;
      } else if (transaction.currency_type === 'rubles') {
        acc.rubles += amount;
      }
      return acc;
    }, { vcoins: 0, rubles: 0 });

    setTotals(totals);
  };

  const handlePeriodChange = (period) => {
    setFilters(prev => ({ ...prev, period }));

    const today = new Date();
    let dateFrom = '';
    const dateTo = today.toISOString().split('T')[0];

    if (period === 'today') {
      dateFrom = dateTo;
    } else if (period === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFrom = weekAgo.toISOString().split('T')[0];
    } else if (period === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFrom = monthAgo.toISOString().split('T')[0];
    }

    if (period !== 'custom') {
      setFilters(prev => ({ ...prev, dateFrom, dateTo: period === 'all' ? '' : dateTo }));
    }
  };

  const groupByDate = (transactions) => {
    const grouped = {};
    transactions.forEach(transaction => {
      const date = new Date(transaction.created_at).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(transaction);
    });
    return grouped;
  };

  const groupedTransactions = groupByDate(transactions);

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'referral_bonus':
        return '👥';
      case 'tournament_bonus':
        return '🎯';
      case 'deposit_bonus':
        return '💰';
      case 'withdrawal':
        return '💸';
      case 'tournament_reward':
        return '🏆';
      default:
        return '💵';
    }
  };

  return (
    <div className="transactions-page" data-easytag="id12-src/components/Transactions">
      <div className="transactions-container">
        <h1 className="transactions-title">История транзакций</h1>

        <div className="transactions-filters">
          <div className="filter-group">
            <label>Тип валюты:</label>
            <div className="filter-buttons">
              <button
                className={filters.currencyType === 'all' ? 'active' : ''}
                onClick={() => setFilters(prev => ({ ...prev, currencyType: 'all' }))}
              >
                Все
              </button>
              <button
                className={filters.currencyType === 'vcoins' ? 'active' : ''}
                onClick={() => setFilters(prev => ({ ...prev, currencyType: 'vcoins' }))}
              >
                V-Coins
              </button>
              <button
                className={filters.currencyType === 'rubles' ? 'active' : ''}
                onClick={() => setFilters(prev => ({ ...prev, currencyType: 'rubles' }))}
              >
                ₽
              </button>
            </div>
          </div>

          <div className="filter-group">
            <label>Тип транзакции:</label>
            <div className="filter-buttons">
              <button
                className={filters.transactionType === 'all' ? 'active' : ''}
                onClick={() => setFilters(prev => ({ ...prev, transactionType: 'all' }))}
              >
                Все
              </button>
              <button
                className={filters.transactionType === 'referral_bonus' ? 'active' : ''}
                onClick={() => setFilters(prev => ({ ...prev, transactionType: 'referral_bonus' }))}
              >
                Реферальный бонус
              </button>
              <button
                className={filters.transactionType === 'tournament_bonus' ? 'active' : ''}
                onClick={() => setFilters(prev => ({ ...prev, transactionType: 'tournament_bonus' }))}
              >
                Глубинный кэшбэк
              </button>
              <button
                className={filters.transactionType === 'deposit_bonus' ? 'active' : ''}
                onClick={() => setFilters(prev => ({ ...prev, transactionType: 'deposit_bonus' }))}
              >
                % с депозита
              </button>
              <button
                className={filters.transactionType === 'withdrawal' ? 'active' : ''}
                onClick={() => setFilters(prev => ({ ...prev, transactionType: 'withdrawal' }))}
              >
                Вывод
              </button>
            </div>
          </div>

          <div className="filter-group">
            <label>Период:</label>
            <div className="filter-buttons">
              <button
                className={filters.period === 'all' ? 'active' : ''}
                onClick={() => handlePeriodChange('all')}
              >
                Все время
              </button>
              <button
                className={filters.period === 'today' ? 'active' : ''}
                onClick={() => handlePeriodChange('today')}
              >
                Сегодня
              </button>
              <button
                className={filters.period === 'week' ? 'active' : ''}
                onClick={() => handlePeriodChange('week')}
              >
                Неделя
              </button>
              <button
                className={filters.period === 'month' ? 'active' : ''}
                onClick={() => handlePeriodChange('month')}
              >
                Месяц
              </button>
              <button
                className={filters.period === 'custom' ? 'active' : ''}
                onClick={() => handlePeriodChange('custom')}
              >
                Произвольный
              </button>
            </div>
          </div>

          {filters.period === 'custom' && (
            <div className="filter-group date-range">
              <div className="date-input">
                <label>От:</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>
              <div className="date-input">
                <label>До:</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>

        <div className="transactions-list">
          {transactions.length === 0 && !loading ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>У вас пока нет транзакций</h3>
              <p>Пригласите друга и получите первый бонус</p>
              <button className="cta-button">Пригласить друга</button>
            </div>
          ) : (
            Object.keys(groupedTransactions).map(date => (
              <div key={date} className="transaction-group">
                <div className="group-date">{date}</div>
                {groupedTransactions[date].map((transaction) => (
                  <div key={transaction.id} className="transaction-card">
                    <div className="transaction-icon">
                      {getTransactionIcon(transaction.transaction_type)}
                    </div>
                    <div className="transaction-details">
                      <div className="transaction-type">
                        {transactionTypeLabels[transaction.transaction_type] || transaction.transaction_type}
                      </div>
                      <div className="transaction-description">
                        {transaction.description}
                        {transaction.related_user_name && (
                          <span className="related-user"> • {transaction.related_user_name}</span>
                        )}
                      </div>
                      <div className="transaction-time">
                        {new Date(transaction.created_at).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="transaction-amount">
                      <div className={`amount ${parseFloat(transaction.amount) >= 0 ? 'positive' : 'negative'}`}>
                        {parseFloat(transaction.amount) >= 0 ? '+' : ''}{transaction.amount}
                      </div>
                      <div className="currency">
                        {currencyLabels[transaction.currency_type] || transaction.currency_type}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}

          {pagination.hasMore && (
            <div className="load-more-container">
              <button
                className="load-more-button"
                onClick={() => loadTransactions(false)}
                disabled={loading}
              >
                {loading ? 'Загрузка...' : 'Загрузить еще'}
              </button>
            </div>
          )}

          {loading && transactions.length === 0 && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Загрузка транзакций...</p>
            </div>
          )}
        </div>

        {transactions.length > 0 && (
          <div className="transactions-totals">
            <h3>Итого за выбранный период:</h3>
            <div className="totals-grid">
              <div className="total-item">
                <div className="total-label">V-Coins:</div>
                <div className="total-value">{totals.vcoins.toFixed(2)}</div>
              </div>
              <div className="total-item">
                <div className="total-label">Рубли:</div>
                <div className="total-value">{totals.rubles.toFixed(2)} ₽</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transactions;
