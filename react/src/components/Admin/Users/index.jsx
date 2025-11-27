import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers } from '../../../api/admin';
import './styles.css';

const Users = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null });
  const [filters, setFilters] = useState({
    user_type: '',
    rank: '',
    search: '',
    page: 1,
    page_size: 20
  });
  const [sortBy, setSortBy] = useState({ field: 'created_at', direction: 'desc' });

  useEffect(() => {
    loadUsers();
  }, [filters]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsers(filters);
      setUsers(data.results || []);
      setPagination({
        count: data.count,
        next: data.next,
        previous: data.previous
      });
    } catch (err) {
      setError(err.message || 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleSort = (field) => {
    const newDirection = sortBy.field === field && sortBy.direction === 'asc' ? 'desc' : 'asc';
    setSortBy({ field, direction: newDirection });
    
    const sorted = [...users].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];
      
      if (newDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    setUsers(sorted);
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleUserClick = (userId) => {
    navigate(`/admin/users/${userId}`);
  };

  const totalPages = Math.ceil(pagination.count / filters.page_size);

  return (
    <div data-easytag="id16-src/components/Admin/Users" className="admin-users">
      <div className="admin-header">
        <h1>Пользователи</h1>
        <p>Управление пользователями системы</p>
      </div>

      <div className="filters-panel">
        <div className="filter-group">
          <label>Поиск</label>
          <input
            type="text"
            placeholder="Имя, username, Telegram ID..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label>Тип пользователя</label>
          <select
            value={filters.user_type}
            onChange={(e) => handleFilterChange('user_type', e.target.value)}
            className="filter-select"
          >
            <option value="">Все</option>
            <option value="player">Игроки</option>
            <option value="influencer">Инфлюенсеры</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Ранг</label>
          <select
            value={filters.rank}
            onChange={(e) => handleFilterChange('rank', e.target.value)}
            className="filter-select"
          >
            <option value="">Все</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
            <option value="diamond">Diamond</option>
          </select>
        </div>

        <button onClick={loadUsers} className="filter-refresh">
          🔄 Обновить
        </button>
      </div>

      {loading && <div className="loading">Загрузка пользователей...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('id')} className="sortable">
                    ID {sortBy.field === 'id' && (sortBy.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('first_name')} className="sortable">
                    Имя {sortBy.field === 'first_name' && (sortBy.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('username')} className="sortable">
                    Username {sortBy.field === 'username' && (sortBy.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('user_type')} className="sortable">
                    Тип {sortBy.field === 'user_type' && (sortBy.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('rank')} className="sortable">
                    Ранг {sortBy.field === 'rank' && (sortBy.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('v_coins_balance')} className="sortable">
                    V-Coins {sortBy.field === 'v_coins_balance' && (sortBy.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('cash_balance')} className="sortable">
                    ₽ {sortBy.field === 'cash_balance' && (sortBy.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Рефералов</th>
                  <th onClick={() => handleSort('created_at')} className="sortable">
                    Дата {sortBy.field === 'created_at' && (sortBy.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} onClick={() => handleUserClick(user.id)} className="user-row">
                    <td>{user.id}</td>
                    <td>
                      <div className="user-name-cell">
                        <div>{user.first_name} {user.last_name || ''}</div>
                        {user.is_blocked && <span className="blocked-badge">🚫</span>}
                      </div>
                    </td>
                    <td>{user.username ? `@${user.username}` : '-'}</td>
                    <td>
                      <span className={`type-badge ${user.user_type}`}>
                        {user.user_type === 'influencer' ? 'Инфлюенсер' : 'Игрок'}
                      </span>
                    </td>
                    <td>
                      <span className={`rank-badge ${user.rank}`}>
                        {user.rank}
                      </span>
                    </td>
                    <td>{user.v_coins_balance.toLocaleString('ru-RU')}</td>
                    <td>{user.cash_balance.toLocaleString('ru-RU')}</td>
                    <td>-</td>
                    <td>{new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
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

export default Users;
