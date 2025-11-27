import React from 'react';
import { useNavigate } from 'react-router-dom';
import './styles.css';

const NotFound = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="notfound-page" data-easytag="id22-src/components/NotFound">
      <div className="notfound-container">
        <div className="poker-background">
          <div className="poker-card card-1">♠</div>
          <div className="poker-card card-2">♥</div>
          <div className="poker-card card-3">♦</div>
          <div className="poker-card card-4">♣</div>
          <div className="poker-chip chip-1"></div>
          <div className="poker-chip chip-2"></div>
          <div className="poker-chip chip-3"></div>
        </div>

        <div className="notfound-content">
          <h1 className="error-code">404</h1>
          <h2 className="error-title">Страница не найдена</h2>
          <p className="error-description">
            К сожалению, запрашиваемая страница не существует.
            <br />
            Возможно, она была удалена или вы ввели неверный адрес.
          </p>
          <button className="home-button" onClick={handleGoHome}>
            Вернуться на главную
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
