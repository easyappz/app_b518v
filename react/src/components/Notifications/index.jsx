import React, { useEffect, useState } from 'react';
import { getNotifications, markAsRead } from '../../api/notifications';
import './styles.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await getNotifications({ page, page_size: 20 });
      setNotifications(data.results);
      setTotalCount(data.count);
      setTotalPages(Math.ceil(data.count / 20));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await markAsRead(id);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      await Promise.all(unreadNotifications.map(n => markAsRead(n.id)));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'referral_bonus':
      case 'tournament_bonus':
      case 'deposit_bonus':
        return '💰';
      case 'rank_upgrade':
        return '⭐';
      case 'withdrawal_approved':
      case 'withdrawal_rejected':
        return '💳';
      case 'system':
      default:
        return '🔔';
    }
  };

  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays === 1) return 'вчера';
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString('ru-RU');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="notifications-page" data-easytag="id21-src/components/Notifications">
      <div className="notifications-container">
        <div className="notifications-header">
          <h1>Уведомления</h1>
          {unreadCount > 0 && (
            <button 
              className="mark-all-read-btn"
              onClick={handleMarkAllAsRead}
            >
              Отметить все как прочитанные
            </button>
          )}
        </div>

        {loading ? (
          <div className="notifications-loading">
            <div className="spinner"></div>
            <p>Загрузка уведомлений...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="empty-icon">🔔</div>
            <h2>Нет уведомлений</h2>
            <p>У вас пока нет уведомлений</p>
          </div>
        ) : (
          <>
            <div className="notifications-list">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                  onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.notification_type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-header-info">
                      <h3>{notification.title}</h3>
                      {!notification.is_read && <span className="unread-dot"></span>}
                    </div>
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-time">
                      {getRelativeTime(notification.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="notifications-pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  ← Назад
                </button>
                <span className="pagination-info">
                  Страница {page} из {totalPages}
                </span>
                <button
                  className="pagination-btn"
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                >
                  Вперед →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Notifications;
