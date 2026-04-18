import React from 'react';
import './SeverityBadge.css';

const severityConfig = {
  critical: { label: 'CRITICAL', className: 'severity-critical' },
  high: { label: 'HIGH', className: 'severity-high' },
  medium: { label: 'MEDIUM', className: 'severity-medium' },
  low: { label: 'LOW', className: 'severity-low' },
};

export default function SeverityBadge({ severity }) {
  const config = severityConfig[severity] || severityConfig.low;
  return (
    <span className={`severity-badge badge-pill ${config.className}`}>
      <span className="severity-dot" />
      {config.label}
    </span>
  );
}