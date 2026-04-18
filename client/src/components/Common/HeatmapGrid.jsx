import React from 'react';
import './HeatmapGrid.css';

const severityColors = { critical: 'var(--color-critical)', high: 'var(--color-high)', medium: 'var(--color-medium)', low: 'var(--color-low)' };

export default function HeatmapGrid({ data = [] }) {
  if (!data.length) return <div className="heatmap-empty text-mono">NO DATA</div>;
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="heatmap-grid">
      {data.map((cell, i) => (
        <div key={i} className="heatmap-cell" style={{
          background: severityColors[cell.severity] || 'var(--color-accent)',
          opacity: 0.3 + (cell.count / maxCount) * 0.7,
        }} title={`${cell.count} incidents (${cell.severity})`}>
          <span className="heatmap-count">{cell.count}</span>
        </div>
      ))}
    </div>
  );
}
