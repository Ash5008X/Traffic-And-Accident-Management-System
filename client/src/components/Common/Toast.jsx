import React, { useState, useEffect, createContext, useContext } from 'react';
import './Toast.css';

const ToastContext = createContext(null);
let globalAddToast = null;

export function useToast() {
  return { addToast: (msg, type = 'info') => globalAddToast && globalAddToast(msg, type) };
}

export function showToast(msg, type = 'info') {
  if (globalAddToast) globalAddToast(msg, type);
}

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  globalAddToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast-item toast-${t.type}`} onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
          <span className="toast-icon">{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}</span>
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
