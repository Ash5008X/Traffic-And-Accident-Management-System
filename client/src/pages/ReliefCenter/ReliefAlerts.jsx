import React, { useState, useEffect } from 'react';
import ReliefNavbar from '../../components/Navbar/ReliefNavbar';
import BottomTabBar from '../../components/BottomTabBar/BottomTabBar';
import AlertCard from '../../components/AlertCard/AlertCard';
import SkeletonLoader from '../../components/Common/SkeletonLoader';
import { useSocket } from '../../context/SocketContext';
import { showToast } from '../../components/Common/Toast';
import api from '../../services/api';
import './ReliefAlerts.css';

export default function ReliefAlerts() {
  const socket = useSocket();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ type: 'system', message: '', zone: '', severity: 'medium', radius: 5 });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAlerts();
    if (socket) {
      socket.on('alert:broadcast', (a) => setAlerts(prev => [a, ...prev]));
      return () => socket.off('alert:broadcast');
    }
  }, [socket]);

  const loadAlerts = async () => {
    try {
      const res = await api.get('/alerts/history');
      setAlerts(res.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.message) { showToast('Message required', 'error'); return; }
    setSubmitting(true);
    try {
      await api.post('/alerts', form);
      showToast('Alert broadcast!', 'success');
      setShowCreate(false);
      setForm({ type: 'system', message: '', zone: '', severity: 'medium', radius: 5 });
      loadAlerts();
    } catch (err) { showToast('Failed', 'error'); } finally { setSubmitting(false); }
  };

  const handleCancel = async (id) => {
    try {
      await api.patch(`/alerts/${id}/cancel`);
      showToast('Alert cancelled', 'info');
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, active: false } : a));
    } catch (err) { showToast('Failed', 'error'); }
  };

  return (
    <div className="relief-alerts-page">
      <ReliefNavbar />
      <main className="relief-alerts-content">
        <div className="relief-alerts-header">
          <h1 className="text-heading page-title">📡 ALERT MANAGEMENT</h1>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ SEND ALERT</button>
        </div>
        {loading ? <SkeletonLoader lines={5} /> : alerts.length === 0 ? (
          <div className="empty-state">No alerts created yet</div>
        ) : (
          <div className="alerts-grid">
            {alerts.map(a => (
              <div key={a._id} className="alert-item">
                <AlertCard alert={a} />
                {a.active && <button className="btn btn-danger cancel-alert-btn" onClick={() => handleCancel(a._id)}>CANCEL ALERT</button>}
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">📡 BROADCAST ALERT</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="select-field" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="accident">Accident</option><option value="congestion">Congestion</option><option value="route_update">Route Update</option><option value="system">System</option><option value="all_clear">All Clear</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Severity</label>
                <select className="select-field" value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}>
                  <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Zone</label>
                <input className="input-field" placeholder="e.g. Western Highway" value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Radius (km)</label>
                <input className="input-field" type="number" min="1" max="100" value={form.radius} onChange={e => setForm(p => ({ ...p, radius: parseInt(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Message *</label>
                <textarea className="input-field" placeholder="Alert message..." rows={3} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'SENDING...' : 'BROADCAST'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <BottomTabBar role="relief_admin" />
    </div>
  );
}
