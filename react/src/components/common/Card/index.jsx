import React from 'react';
import './styles.css';

const Card = ({ 
  children, 
  className = '',
  glow = false,
  onClick,
  ...props 
}) => {
  const cardClass = [
    'card',
    glow && 'card-glow',
    onClick && 'card-clickable',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClass}
      onClick={onClick}
      data-easytag="id3-src/components/common/Card"
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
