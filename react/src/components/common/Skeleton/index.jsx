import React from 'react';
import './styles.css';

const Skeleton = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = '4px',
  variant = 'text',
  count = 1,
  className = '' 
}) => {
  const skeletons = Array(count).fill(0);

  const getVariantStyles = () => {
    switch (variant) {
      case 'circle':
        return { width: height, borderRadius: '50%' };
      case 'rectangular':
        return { borderRadius: '0' };
      case 'rounded':
        return { borderRadius: 'var(--radius-lg)' };
      default:
        return { borderRadius };
    }
  };

  return (
    <div className="skeleton-container" data-easytag="id23-src/components/common/Skeleton">
      {skeletons.map((_, index) => (
        <div
          key={index}
          className={`skeleton ${className}`}
          style={{
            width,
            height,
            ...getVariantStyles()
          }}
        >
          <div className="skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
};

export default Skeleton;
