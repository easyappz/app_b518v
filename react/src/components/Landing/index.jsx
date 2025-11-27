import React from 'react';
import { useNavigate } from 'react-router-dom';
import './styles.css';

const Landing = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/auth');
  };

  return (
    <div className="landing" data-easytag="id5-src/components/Landing">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="animated-card card-1"></div>
          <div className="animated-card card-2"></div>
          <div className="animated-card card-3"></div>
          <div className="animated-chip chip-1"></div>
          <div className="animated-chip chip-2"></div>
          <div className="animated-chip chip-3"></div>
        </div>
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="neon-text">Poker Chain</span>
          </h1>
          <p className="hero-subtitle">
            Реферальная система с глубиной до 10 уровней
          </p>
          <button className="cta-button" onClick={handleGetStarted}>
            <span>Начать зарабатывать</span>
          </button>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div className="container">
          <h2 className="section-title">Как это работает</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-icon step-icon-1">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3 className="step-title">Зарегистрируйся через Telegram</h3>
              <p className="step-description">
                Быстрая регистрация через Telegram бота без лишних форм
              </p>
            </div>

            <div className="step-card">
              <div className="step-icon step-icon-2">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h3 className="step-title">Приглашай друзей по своей ссылке</h3>
              <p className="step-description">
                Получи уникальную реферальную ссылку и делись ей с друзьями
              </p>
            </div>

            <div className="step-card">
              <div className="step-icon step-icon-3">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <h3 className="step-title">Получай бонусы с 10 уровней глубины</h3>
              <p className="step-description">
                Зарабатывай не только с прямых рефералов, но и с их приглашенных друзей
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Rewards Section */}
      <section className="rewards-section">
        <div className="container">
          <h2 className="section-title">Система вознаграждений</h2>
          <div className="rewards-grid">
            <div className="reward-card player-card">
              <div className="reward-badge">Игрок</div>
              <h3 className="reward-title">V-Coins</h3>
              <div className="reward-details">
                <div className="reward-item">
                  <div className="reward-amount">1000</div>
                  <div className="reward-label">V-Coins за прямого реферала</div>
                </div>
                <div className="reward-divider"></div>
                <div className="reward-item">
                  <div className="reward-amount">до 250</div>
                  <div className="reward-label">V-Coins с глубины (уровни 2-10)</div>
                </div>
              </div>
              <ul className="reward-features">
                <li>✓ Виртуальная валюта для игр</li>
                <li>✓ Бонусы от рангов</li>
                <li>✓ Обмен на реальные деньги</li>
              </ul>
            </div>

            <div className="reward-card influencer-card">
              <div className="reward-badge">Инфлюенсер</div>
              <h3 className="reward-title">Реальные деньги</h3>
              <div className="reward-details">
                <div className="reward-item">
                  <div className="reward-amount">500₽</div>
                  <div className="reward-label">За прямого реферала</div>
                </div>
                <div className="reward-item">
                  <div className="reward-amount">+10%</div>
                  <div className="reward-label">С каждого депозита реферала</div>
                </div>
                <div className="reward-divider"></div>
                <div className="reward-item">
                  <div className="reward-amount">до 125₽</div>
                  <div className="reward-label">С глубины (уровни 2-10)</div>
                </div>
              </div>
              <ul className="reward-features">
                <li>✓ Выплаты в рублях</li>
                <li>✓ Процент с депозитов</li>
                <li>✓ Повышенные бонусы с рангов</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Rank System Section */}
      <section className="rank-section">
        <div className="container">
          <h2 className="section-title">Ранговая система</h2>
          <div className="ranks-grid">
            <div className="rank-card rank-standard">
              <div className="rank-icon">⭐</div>
              <h3 className="rank-name">Стандарт</h3>
              <div className="rank-condition">Стартовый ранг</div>
              <ul className="rank-benefits">
                <li>Базовые бонусы</li>
                <li>10 уровней глубины</li>
                <li>Стандартные проценты</li>
              </ul>
            </div>

            <div className="rank-card rank-silver">
              <div className="rank-icon">🥈</div>
              <h3 className="rank-name">Серебро</h3>
              <div className="rank-condition">5+ активных рефералов</div>
              <ul className="rank-benefits">
                <li>+20% к базовым бонусам</li>
                <li>Приоритетная поддержка</li>
                <li>Доступ к аналитике</li>
              </ul>
            </div>

            <div className="rank-card rank-gold">
              <div className="rank-icon">🥇</div>
              <h3 className="rank-name">Золото</h3>
              <div className="rank-condition">20+ активных рефералов</div>
              <ul className="rank-benefits">
                <li>+50% к базовым бонусам</li>
                <li>Эксклюзивные промо</li>
                <li>Личный менеджер</li>
              </ul>
            </div>

            <div className="rank-card rank-platinum">
              <div className="rank-icon">💎</div>
              <h3 className="rank-name">Платина</h3>
              <div className="rank-condition">50+ активных рефералов</div>
              <ul className="rank-benefits">
                <li>+100% к базовым бонусам</li>
                <li>VIP статус</li>
                <li>Индивидуальные условия</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <span className="neon-text-small">Poker Chain</span>
            </div>
            <div className="footer-links">
              <a href="https://t.me/pokerchain_bot" target="_blank" rel="noopener noreferrer" className="footer-link">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                Telegram бот
              </a>
            </div>
            <div className="footer-copyright">
              © 2024 Poker Chain. Все права защищены.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;