import React from 'react';
import './SkeletonLoader.css';

export default function SkeletonLoader({ lines = 3, style }) {
  return (
    <div className="skeleton-loader" style={style}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${85 - i * 15}%`, marginBottom: 8 }} />
      ))}
    </div>
  );
}