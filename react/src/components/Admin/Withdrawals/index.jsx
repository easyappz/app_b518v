import React, { useEffect, useState } from 'react';
import { getWithdrawals, updateWithdrawal } from '../../../api/admin';
import './styles.css';

const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null });
  const [filters, setFilters] = useState({
    status: '',
    user_id: '',
    page: 1,
    page_size: 20
  });
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadWithdrawals();
  }, [filters]);

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      setError(null);
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      const data = await getWithdrawals(cleanFilters);
      setWithdrawals(data.results || []);
      setPagination({
        count: data.count,
        next: data.next,
        previous: data.previous
      });
    } catch (err) {
      setError(err.message || 'Ошибка загрузки заявок на вывод');
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

  const handleApprove = async (id) => {
    if (!confirm('Одобрить заявку на вывод?')) return;
    
    try {
      setProcessingId(id);
      await updateWithdrawal(id, { status: 'approved' });
      await loadWithdrawals();
    } catch (err) {
      alert(err.message || 'Ошибка одобрения заявки');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Укажите причину отклонения:');
    if (!reason) return;
    
    try {
      setProcessingId(id);
      await updateWithdrawal(id, { status: 'rejected', rejection_reason: reason });
      await loadWithdrawals();
    } catch (err) {
      alert(err.message || 'Ошибка отклонения заявки');
    } finally {
      setProcessingId(null);
    }
  };

  const totalPages = Math.ceil(pagination.count / filters.page_size);

  return (
    <div className="admin-withdrawals">
      <div className="admin-header">
        <h1>Заявки на вывод</h1>
        <p>Управление выводом средств</p>
      </div>

      <div className="filters-panel">
        <div className="filter-group">
          <label>Статус</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="filter-select"
          >
            <option value="">Все</option>
            <option value="pending">Ожидает</option>
            <option value="approved">Одобрено</option>
            <option value="rejected">Отклонено</option>
          </select>
        </div>

        <button onClick={loadWithdrawals} className="filter-refresh">
          🔄 Обновить
        </button>
      </div>

      {loading && <div className="loading">Загрузка заявок...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="withdrawals-grid">
            {withdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="withdrawal-card">
                <div className="withdrawal-header">
                  <div className="withdrawal-id">Заявка #{withdrawal.id}</div>
                  <span className={`status-badge ${withdrawal.status}`}>
                    {withdrawal.status === 'pending' && '⏳ Ожидает'}
                    {withdrawal.status === 'approved' && '✅ Одобрено'}
                    {withdrawal.status === 'rejected' && '❌ Отклонено'}
                  </span>
                </div>

                <div className="withdrawal-user">
                  <div className="user-name">
                    {withdrawal.user.first_name} {withdrawal.user.username ? `(@${withdrawal.user.username})` : ''}
                  </div>
                  <span className={`user-type ${withdrawal.user.user_type}`}>
                    {withdrawal.user.user_type === 'influencer' ? 'Инфлюенсер' : 'Игрок'}
                  </span>
                </div>

                <div className="withdrawal-amount">
                  {withdrawal.amount.toLocaleString('ru-RU')} ₽
                </div>

                <div className="withdrawal-details">
                  <div className="detail-row">
                    <span className="detail-label">Способ:</span>
                    <span className="detail-value">{withdrawal.payment_method}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Реквизиты:</span>
                    <span className="detail-value">{withdrawal.payment_details}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Дата:</span>
                    <span className="detail-value">{new Date(withdrawal.created_at).toLocaleString('ru-RU')}</span>
                  </div>
                </div>

                {withdrawal.rejection_reason && (
                  <div className="rejection-reason">
                    <strong>Причина отклонения:</strong> {withdrawal.rejection_reason}
                  </div>
                )}

                {withdrawal.status === 'pending' && (
                  <div className="withdrawal-actions">
                    <button
                      onClick={() => handleApprove(withdrawal.id)}
                      disabled={processingId === withdrawal.id}
                      className="approve-btn"
                    >
                      ✅ Одобрить
                    </button>
                    <button
                      onClick={() => handleReject(withdrawal.id)}
                      disabled={processingId === withdrawal.id}
                      className="reject-btn"
                    >
                      ❌ Отклонить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {withdrawals.length === 0 && (
            <div className="no-data">Нет заявок на вывод</div>
          )}

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

export default Withdrawals;
