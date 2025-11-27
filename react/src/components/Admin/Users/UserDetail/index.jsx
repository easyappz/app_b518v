import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUser, updateUser } from '../../../../api/admin';
import { getTransactions as getUserTransactions } from '../../../../api/transactions';
import { getReferralTree } from '../../../../api/referrals';
import './styles.css';

const UserDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [referralTree, setReferralTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [userData, transData, treeData] = await Promise.all([
        getUser(userId),
        getUserTransactions({ user_id: userId, page_size: 10 }),
        getReferralTree(userId)
      ]);
      setUser(userData);
      setTransactions(transData.results || []);
      setReferralTree(treeData);
      setFormData({
        user_type: userData.user_type,
        rank: userData.rank,
        v_coins_balance: userData.v_coins_balance,
        cash_balance: userData.cash_balance,
        is_blocked: userData.is_blocked
      });
    } catch (err) {
      setError(err.message || 'Ошибка загрузки данных пользователя');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await updateUser(userId, formData);
      setUser(prev => ({ ...prev, ...updated }));
      setEditing(false);
    } catch (err) {
      alert(err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      user_type: user.user_type,
      rank: user.rank,
      v_coins_balance: user.v_coins_balance,
      cash_balance: user.cash_balance,
      is_blocked: user.is_blocked
    });
    setEditing(false);
  };

  if (loading) {
    return (
      <div data-easytag="id17-src/components/Admin/Users/UserDetail" className="user-detail">
        <div className="loading">Загрузка данных пользователя...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-easytag="id17-src/components/Admin/Users/UserDetail" className="user-detail">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/admin/users')} className="back-btn">← Назад к списку</button>
      </div>
    );
  }

  return (
    <div data-easytag="id17-src/components/Admin/Users/UserDetail" className="user-detail">
      <div className="detail-header">
        <button onClick={() => navigate('/admin/users')} className="back-btn">← Назад к списку</button>
        <div className="header-actions">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="edit-btn">✏️ Редактировать</button>
          ) : (
            <>
              <button onClick={handleCancel} className="cancel-btn">Отмена</button>
              <button onClick={handleSave} disabled={saving} className="save-btn">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card info-card">
          <h3>Информация о пользователе</h3>
          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">ID</div>
              <div className="info-value">{user.id}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Telegram ID</div>
              <div className="info-value">{user.telegram_id}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Имя</div>
              <div className="info-value">{user.first_name} {user.last_name || ''}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Username</div>
              <div className="info-value">{user.username ? `@${user.username}` : '-'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Реферальный код</div>
              <div className="info-value">{user.referral_code}</div>
            </div>
            {user.referred_by && (
              <div className="info-item">
                <div className="info-label">Пригласил</div>
                <div className="info-value">
                  {user.referred_by.first_name} {user.referred_by.username ? `(@${user.referred_by.username})` : ''}
                </div>
              </div>
            )}
            <div className="info-item">
              <div className="info-label">Дата регистрации</div>
              <div className="info-value">{new Date(user.created_at).toLocaleString('ru-RU')}</div>
            </div>
          </div>
        </div>

        <div className="detail-card edit-card">
          <h3>Редактируемые данные</h3>
          <div className="form-grid">
            <div className="form-item">
              <label>Тип пользователя</label>
              {editing ? (
                <select
                  value={formData.user_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, user_type: e.target.value }))}
                  className="form-select"
                >
                  <option value="player">Игрок</option>
                  <option value="influencer">Инфлюенсер</option>
                </select>
              ) : (
                <span className={`type-badge ${user.user_type}`}>
                  {user.user_type === 'influencer' ? 'Инфлюенсер' : 'Игрок'}
                </span>
              )}
            </div>

            <div className="form-item">
              <label>Ранг</label>
              {editing ? (
                <select
                  value={formData.rank}
                  onChange={(e) => setFormData(prev => ({ ...prev, rank: e.target.value }))}
                  className="form-select"
                >
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                  <option value="diamond">Diamond</option>
                </select>
              ) : (
                <span className={`rank-badge ${user.rank}`}>{user.rank}</span>
              )}
            </div>

            <div className="form-item">
              <label>V-Coins баланс</label>
              {editing ? (
                <input
                  type="number"
                  step="0.01"
                  value={formData.v_coins_balance}
                  onChange={(e) => setFormData(prev => ({ ...prev, v_coins_balance: parseFloat(e.target.value) }))}
                  className="form-input"
                />
              ) : (
                <div className="balance-value">{user.v_coins_balance.toLocaleString('ru-RU')}</div>
              )}
            </div>

            <div className="form-item">
              <label>Денежный баланс (₽)</label>
              {editing ? (
                <input
                  type="number"
                  step="0.01"
                  value={formData.cash_balance}
                  onChange={(e) => setFormData(prev => ({ ...prev, cash_balance: parseFloat(e.target.value) }))}
                  className="form-input"
                />
              ) : (
                <div className="balance-value">{user.cash_balance.toLocaleString('ru-RU')} ₽</div>
              )}
            </div>

            <div className="form-item">
              <label>Статус блокировки</label>
              {editing ? (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_blocked}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_blocked: e.target.checked }))}
                  />
                  Заблокирован
                </label>
              ) : (
                <div className={`status-badge ${user.is_blocked ? 'blocked' : 'active'}`}>
                  {user.is_blocked ? '🚫 Заблокирован' : '✅ Активен'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="detail-card stats-card">
          <h3>Статистика</h3>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">Всего рефералов</div>
              <div className="stat-value">{user.total_referrals || 0}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Всего заработано</div>
              <div className="stat-value">
                {(user.total_earnings || 0).toLocaleString('ru-RU')} {user.user_type === 'influencer' ? '₽' : 'V'}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-card transactions-card">
          <h3>Последние транзакции</h3>
          {transactions.length > 0 ? (
            <div className="transactions-list">
              {transactions.map((trans) => (
                <div key={trans.id} className="transaction-item">
                  <div className="trans-info">
                    <div className="trans-type">{trans.description}</div>
                    <div className="trans-date">{new Date(trans.created_at).toLocaleString('ru-RU')}</div>
                  </div>
                  <div className={`trans-amount ${trans.amount > 0 ? 'positive' : 'negative'}`}>
                    {trans.amount > 0 ? '+' : ''}{trans.amount.toLocaleString('ru-RU')} {trans.currency === 'v_coins' ? 'V' : '₽'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">Нет транзакций</div>
          )}
        </div>

        <div className="detail-card tree-card">
          <h3>Реферальное дерево</h3>
          {referralTree && referralTree.referrals?.length > 0 ? (
            <div className="tree-info">
              <div className="tree-stat">
                Прямых рефералов: <strong>{referralTree.referrals.length}</strong>
              </div>
              <div className="referrals-list">
                {referralTree.referrals.slice(0, 5).map((ref) => (
                  <div key={ref.id} className="referral-item">
                    <div>{ref.first_name} {ref.username ? `(@${ref.username})` : ''}</div>
                    <div className="ref-stats">
                      <span className={`type-badge ${ref.user_type}`}>
                        {ref.user_type === 'influencer' ? 'Инфл.' : 'Игрок'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {referralTree.referrals.length > 5 && (
                <div className="show-more">и еще {referralTree.referrals.length - 5}...</div>
              )}
            </div>
          ) : (
            <div className="no-data">Нет рефералов</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetail;
