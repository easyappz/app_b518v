import React, { forwardRef } from 'react';
import './styles.css';

const Input = forwardRef(({ 
  label,
  error,
  className = '',
  fullWidth = false,
  type = 'text',
  icon: Icon,
  ...props 
}, ref) => {
  const inputWrapperClass = [
    'input-wrapper',
    fullWidth && 'input-full-width',
    error && 'input-error',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={inputWrapperClass} data-easytag="id4-src/components/common/Input">
      {label && <label className="input-label">{label}</label>}
      
      <div className="input-container">
        {Icon && (
          <div className="input-icon">
            <Icon size={18} />
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          className={`input ${Icon ? 'input-with-icon' : ''}`}
          {...props}
        />
      </div>
      
      {error && <span className="input-error-message">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
