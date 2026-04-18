import React from 'react';
import './TimelineBar.css';

const statusColors = {
  pending: 'var(--color-medium)',
  assigned: 'var(--color-info)',
  en_route: 'var(--color-high)',
  on_site: 'var(--color-accent)',
  resolved: 'var(--color-resolved)',
  dismissed: 'var(--color-inactive)',
};

const statusLabels = ['pending', 'assigned', 'en_route', 'on_site', 'resolved'];

export default function TimelineBar({ status }) {
  const currentIdx = statusLabels.indexOf(status);
  return (
    <div className="timeline-bar">
      {statusLabels.map((s, i) => (
        <div key={s} className={`timeline-step ${i <= currentIdx ? 'active' : ''}`}>
          <div className="timeline-dot" style={{ background: i <= currentIdx ? statusColors[s] : 'var(--bg-elevated)' }} />
          {i < statusLabels.length - 1 && (
            <div className="timeline-line" style={{ background: i < currentIdx ? statusColors[statusLabels[i + 1]] : 'var(--bg-elevated)' }} />
          )}
          <span className="timeline-label">{s.replace('_', ' ')}</span>
        </div>
      ))}
    </div>
  );
}
