import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReferralTree } from '../../api/referrals';
import { useAuthStore } from '../../store/authStore';
import './styles.css';

const ReferralTree = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [maxDepth, setMaxDepth] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    fetchTreeData();
  }, [user, navigate]);

  const fetchTreeData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getReferralTree(user.id);
      setTreeData(data);
      
      // Auto-expand first level
      if (data.tree && data.tree.length > 0) {
        const firstLevel = new Set();
        data.tree.forEach(node => firstLevel.add(node.id));
        setExpandedNodes(firstLevel);
      }
    } catch (err) {
      console.error('Error fetching referral tree:', err);
      setError('Не удалось загрузить реферальное дерево');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const filterTree = (nodes, query, currentLevel = 1) => {
    if (!nodes || nodes.length === 0) return [];
    if (currentLevel > maxDepth) return [];
    
    return nodes.filter(node => {
      if (!query) return true;
      const searchLower = query.toLowerCase();
      return (
        node.first_name?.toLowerCase().includes(searchLower) ||
        node.username?.toLowerCase().includes(searchLower)
      );
    }).map(node => ({
      ...node,
      children: filterTree(node.children, query, currentLevel + 1)
    }));
  };

  const renderNode = (node, level = 1) => {
    if (level > maxDepth) return null;
    
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isActive = new Date(node.registered_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return (
      <div key={node.id} className="tree-node-wrapper" style={{ '--level': level }}>
        <div className={`tree-node ${isActive ? 'active' : ''} level-${level}`}>
          <div className="node-content" onClick={() => hasChildren && toggleNode(node.id)}>
            <div className="node-avatar">
              {node.photo_url ? (
                <img src={node.photo_url} alt={node.first_name} />
              ) : (
                <div className="avatar-placeholder">
                  {node.first_name?.charAt(0) || '?'}
                </div>
              )}
            </div>
            
            <div className="node-info">
              <div className="node-name">
                {node.first_name} {node.last_name || ''}
              </div>
              {node.username && (
                <div className="node-username">@{node.username}</div>
              )}
              <div className="node-meta">
                <span className={`node-rank ${node.user_type}`}>
                  {node.user_type === 'influencer' ? 'Инфлюенсер' : 'Игрок'}
                </span>
                <span className="node-status">
                  {isActive ? '🟢 Активен' : '⚫ Неактивен'}
                </span>
              </div>
              <div className="node-date">
                Регистрация: {new Date(node.registered_at).toLocaleDateString('ru-RU')}
              </div>
              {node.total_referrals_count > 0 && (
                <div className="node-referrals-count">
                  Всего рефералов: {node.total_referrals_count}
                </div>
              )}
            </div>

            {hasChildren && (
              <div className="node-toggle">
                <span className={isExpanded ? 'expanded' : ''}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              </div>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderLevelStats = () => {
    if (!treeData || !treeData.levels) return null;

    const levels = Object.entries(treeData.levels).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    return (
      <div className="level-stats">
        <h3>Статистика по уровням</h3>
        <div className="level-bars">
          {levels.map(([level, count]) => {
            const maxCount = Math.max(...Object.values(treeData.levels));
            const percentage = (count / maxCount) * 100;
            const opacity = 1 - (parseInt(level) - 1) * 0.08;

            return (
              <div key={level} className="level-bar-item">
                <div className="level-label">Уровень {level}</div>
                <div className="level-bar-wrapper">
                  <div 
                    className="level-bar" 
                    style={{ 
                      width: `${percentage}%`,
                      opacity: opacity,
                      '--level-hue': (parseInt(level) - 1) * 30
                    }}
                  >
                    <span className="level-count">{count}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="referral-tree-container" data-easytag="id11-src/components/ReferralTree">
        <div className="loading">Загрузка реферального дерева...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="referral-tree-container" data-easytag="id11-src/components/ReferralTree">
        <div className="error">{error}</div>
        <button onClick={fetchTreeData} className="retry-button">Повторить</button>
      </div>
    );
  }

  const filteredTree = treeData ? filterTree(treeData.tree, searchQuery) : [];

  return (
    <div className="referral-tree-container" data-easytag="id11-src/components/ReferralTree">
      <div className="tree-header">
        <h1>Моё реферальное дерево</h1>
        <div className="tree-controls">
          <div className="control-group">
            <label htmlFor="depth-select">Глубина отображения:</label>
            <select 
              id="depth-select"
              value={maxDepth} 
              onChange={(e) => setMaxDepth(parseInt(e.target.value))}
              className="depth-selector"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => (
                <option key={d} value={d}>{d} {d === 1 ? 'уровень' : d < 5 ? 'уровня' : 'уровней'}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="search-input">Поиск по имени:</label>
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Введите имя или username"
              className="search-input"
            />
          </div>
        </div>
      </div>

      <div className="tree-summary">
        <div className="summary-card">
          <div className="summary-label">Всего в дереве</div>
          <div className="summary-value">{treeData?.total_referrals || 0}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Ваш реферальный код</div>
          <div className="summary-value code">{treeData?.referral_code || '-'}</div>
        </div>
      </div>

      {renderLevelStats()}

      <div className="tree-visualization">
        <h3>Структура дерева</h3>
        <div className="tree-root">
          <div className="tree-node root-node">
            <div className="node-content">
              <div className="node-avatar">
                {user?.photo_url ? (
                  <img src={user.photo_url} alt={user.first_name} />
                ) : (
                  <div className="avatar-placeholder">
                    {user?.first_name?.charAt(0) || 'Я'}
                  </div>
                )}
              </div>
              <div className="node-info">
                <div className="node-name">
                  {user?.first_name} {user?.last_name || ''} (Вы)
                </div>
                {user?.username && (
                  <div className="node-username">@{user.username}</div>
                )}
                <div className="node-meta">
                  <span className={`node-rank ${user?.user_type}`}>
                    {user?.user_type === 'influencer' ? 'Инфлюенсер' : 'Игрок'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {filteredTree.length > 0 ? (
            <div className="tree-children root-children">
              {filteredTree.map(node => renderNode(node, 1))}
            </div>
          ) : (
            <div className="tree-empty">
              {searchQuery ? 'Рефералы не найдены' : 'У вас пока нет рефералов'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralTree;
