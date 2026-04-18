import React from 'react';
import './StatusToggle.css';

export default function StatusToggle({ isOn, onToggle, labelOn = 'ON DUTY', labelOff = 'OFF DUTY', disabled }) {
  return (
    <div className={`status-toggle ${isOn ? 'on' : 'off'}`}>
      <div className="status-toggle-pills">
        <button
          type="button"
          className="status-toggle-pill on-pill"
          onClick={isOn ? undefined : onToggle}
          disabled={disabled}
        >
          ON
        </button>
        <button
          type="button"
          className="status-toggle-pill off-pill"
          onClick={isOn ? onToggle : undefined}
          disabled={disabled}
        >
          OFF
        </button>
      </div>
    </div>
  );
}