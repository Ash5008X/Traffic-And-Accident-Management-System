import React from 'react';
import './LiveBadge.css';

export default function LiveBadge({ text = 'LIVE' }) {
  return (
    <span className="live-badge badge-pill">
      <span className="live-dot" />
      {text}
    </span>
  );
}