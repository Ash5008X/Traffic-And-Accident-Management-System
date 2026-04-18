import React from 'react';
import './StatChip.css';

export default function StatChip({ label, value, color, icon }) {
  return (
    <div className="stat-chip" style={{ '--chip-color': color || 'var(--color-accent)' }}>
      {icon && <span className="stat-chip-icon">{icon}</span>}
      <span className="stat-chip-value text-heading">{value}</span>
      <span className="stat-chip-label">{label}</span>
    </div>
  );
}