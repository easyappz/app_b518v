import React, { useState, useEffect } from 'react';
import { getWithdrawals, updateWithdrawal } from '../../../api/admin';
import './styles.css';

const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null
  });

  const [filters, setFilters] = useState({
    status: '',
    user_id: '',
    page: 1,
    page_size: 20
  });

  const [modalState, setModalState] = useState({
    isOpen: false,
    action: null,
    withdrawal: null,
    rejectionReason: ''
  });

  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchWithdrawals();
  }, [filters.page, filters.status]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.user_id) params.user_id = filters.user_id;
      params.page = filters.page;
      params.page_size = filters.page_size;

      const data = await getWithdrawals(params);
      setWithdrawals(data.results || []);
      setPagination({
        count: data.count,
        next: data.next,
        previous: data.previous
      });
    } catch (err) {
      console.error('Error fetching withdrawals:', err);
      setError('Ошибка загрузки заявок на вывод');
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

  const openModal = (action, withdrawal) => {
    setModalState({
      isOpen: true,
      action,
      withdrawal,
      rejectionReason: ''
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      action: null,
      withdrawal: null,
      rejectionReason: ''
    });
  };

  const handleUpdateWithdrawal = async () => {
    if (!modalState.withdrawal) return;

    if (modalState.action === 'rejected' && !modalState.rejectionReason.trim()) {
      alert('Укажите причину отклонения');
      return;
    }

    try {
      setProcessing(true);
      const updateData = {
        status: modalState.action
      };

      if (modalState.action === 'rejected') {
        updateData.rejection_reason = modalState.rejectionReason;
      }

      await updateWithdrawal(modalState.withdrawal.id, updateData);
      
      closeModal();
      fetchWithdrawals();
    } catch (err) {
      console.error('Error updating withdrawal:', err);
      alert('Ошибка при обновлении заявки');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Ожидает',
      approved: 'Одобрено',
      rejected: 'Отклонено'
    };
    return labels[status] || status;
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
    <div data-easytag="id19-src/components/Admin/Withdrawals" className="admin-withdrawals">
      <div className="admin-header">
        <h1>Заявки на вывод</h1>
        <p>Управление выводом средств</p>
      </div>

      <div className="withdrawals-filters">
        <div className="filters-row">
          <div className="filter-group">
            <label>Статус</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="">Все</option>
              <option value="pending">Ожидает</option>
              <option value="approved">Одобрено</option>
              <option value="rejected">Отклонено</option>
            </select>
          </div>

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

          <button className="btn-apply" onClick={fetchWithdrawals}>
            Применить
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
          <p>Загрузка заявок...</p>
        </div>
      ) : (
        <>
          <div className="withdrawals-table-container">
            <table className="withdrawals-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Пользователь</th>
                  <th>Сумма</th>
                  <th>Метод</th>
                  <th>Реквизиты</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-data">
                      Заявки не найдены
                    </td>
                  </tr>
                ) : (
                  withdrawals.map(withdrawal => (
                    <tr key={withdrawal.id}>
                      <td>#{withdrawal.id}</td>
                      <td>
                        <div className="user-cell">
                          <div className="user-name">
                            {withdrawal.user?.first_name || 'N/A'}
                          </div>
                          {withdrawal.user?.username && (
                            <div className="user-username">@{withdrawal.user.username}</div>
                          )}
                          <div className="user-type">
                            {withdrawal.user?.user_type === 'influencer' ? '⭐ Инфлюенсер' : '👤 Игрок'}
                          </div>
                        </div>
                      </td>
                      <td className="amount-cell">
                        {parseFloat(withdrawal.amount).toLocaleString('ru-RU', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })} ₽
                      </td>
                      <td>{withdrawal.payment_method || 'N/A'}</td>
                      <td className="details-cell">
                        {withdrawal.payment_details || 'N/A'}
                      </td>
                      <td>
                        <span className={`status-badge status-${withdrawal.status}`}>
                          {getStatusLabel(withdrawal.status)}
                        </span>
                        {withdrawal.rejection_reason && (
                          <div className="rejection-reason" title={withdrawal.rejection_reason}>
                            ⚠️ {withdrawal.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="date-cell">
                        {formatDate(withdrawal.created_at)}
                      </td>
                      <td>
                        {withdrawal.status === 'pending' ? (
                          <div className="action-buttons">
                            <button
                              className="btn-approve"
                              onClick={() => openModal('approved', withdrawal)}
                              title="Одобрить"
                            >
                              ✓
                            </button>
                            <button
                              className="btn-reject"
                              onClick={() => openModal('rejected', withdrawal)}
                              title="Отклонить"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="no-actions">—</span>
                        )}
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

      {modalState.isOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalState.action === 'approved' ? 'Одобрить заявку' : 'Отклонить заявку'}
              </h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-body">
              <div className="withdrawal-info">
                <p><strong>Пользователь:</strong> {modalState.withdrawal?.user?.first_name}</p>
                <p><strong>Сумма:</strong> {parseFloat(modalState.withdrawal?.amount || 0).toLocaleString('ru-RU')} ₽</p>
                <p><strong>Метод:</strong> {modalState.withdrawal?.payment_method}</p>
                <p><strong>Реквизиты:</strong> {modalState.withdrawal?.payment_details}</p>
              </div>

              {modalState.action === 'rejected' && (
                <div className="form-group">
                  <label>Причина отклонения *</label>
                  <textarea
                    value={modalState.rejectionReason}
                    onChange={(e) => setModalState(prev => ({ ...prev, rejectionReason: e.target.value }))}
                    placeholder="Укажите причину отклонения заявки"
                    rows="4"
                  />
                </div>
              )}

              {modalState.action === 'approved' && (
                <div className="confirmation-text">
                  Вы уверены, что хотите одобрить эту заявку на вывод средств?
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeModal} disabled={processing}>
                Отмена
              </button>
              <button
                className={modalState.action === 'approved' ? 'btn-confirm-approve' : 'btn-confirm-reject'}
                onClick={handleUpdateWithdrawal}
                disabled={processing}
              >
                {processing ? 'Обработка...' : modalState.action === 'approved' ? 'Одобрить' : 'Отклонить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Withdrawals;
