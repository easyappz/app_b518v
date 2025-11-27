import React from 'react';
import './styles.css';

const Button = ({ 
  children, 
  variant = 'primary', 
  onClick, 
  disabled = false, 
  loading = false,
  type = 'button',
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const buttonClass = [
    'btn',
    `btn-${variant}`,
    fullWidth && 'btn-full-width',
    loading && 'btn-loading',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={buttonClass}
      onClick={onClick}
      disabled={disabled || loading}
      data-easytag="id2-src/components/common/Button"
      {...props}
    >
      {loading ? (
        <div className="btn-spinner">
          <div className="spinner"></div>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
