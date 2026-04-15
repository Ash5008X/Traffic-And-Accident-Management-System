import React, { useState, useEffect } from 'react';
import ReliefNavbar from '../../components/Navbar/ReliefNavbar';
import BottomTabBar from '../../components/BottomTabBar/BottomTabBar';
import IncidentCard from '../../components/IncidentCard/IncidentCard';
import IncidentDetail from '../../components/IncidentDetail/IncidentDetail';
import ChatThread from '../../components/ChatThread/ChatThread';
import SkeletonLoader from '../../components/Common/SkeletonLoader';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Common/Toast';
import api from '../../services/api';
import './ActiveIncidents.css';

export default function ActiveIncidents() {
  const { user } = useAuth();
  const socket = useSocket();
  const [incidents, setIncidents] = useState([]);
  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    loadIncidents();
    if (socket) {
      socket.on('incident:new', (inc) => { setIncidents(prev => [inc, ...prev]); showToast('New incident reported!', 'warning'); });
      socket.on('incident:updated', (updated) => {
        setIncidents(prev => prev.map(i => i._id === updated._id ? updated : i));
        if (selected && selected._id === updated._id) setSelected(updated);
      });
      socket.on('chat:message', (msg) => { setChatMessages(prev => [...prev, msg]); });
      return () => { socket.off('incident:new'); socket.off('incident:updated'); socket.off('chat:message'); };
    }
  }, [socket, selected]);

  const loadIncidents = async () => {
    try {
      const res = await api.get('/incidents');
      setIncidents(res.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleSelect = (inc) => {
    setSelected(inc);
    setChatMessages(inc.chat || []);
    if (socket) socket.emit('join:incident', { incidentId: inc._id });
  };

  const handleAccept = async (inc) => {
    try {
      await api.patch(`/incidents/${inc._id}/accept`, { unitId: user._id });
      if (socket) socket.emit('incident:accept', { incidentId: inc._id });
      showToast('Incident accepted!', 'success');
      loadIncidents();
    } catch (err) { showToast('Failed to accept', 'error'); }
  };

  const handleDismiss = async (inc) => {
    try {
      await api.patch(`/incidents/${inc._id}/dismiss`);
      showToast('Incident dismissed', 'info');
      loadIncidents();
      if (selected?._id === inc._id) setSelected(null);
    } catch (err) { showToast('Failed to dismiss', 'error'); }
  };

  const handleUpdateStatus = async (inc, status) => {
    try {
      await api.patch(`/incidents/${inc._id}/status`, { status });
      showToast(`Status → ${status.toUpperCase()}`, 'success');
      loadIncidents();
    } catch (err) { showToast('Failed to update', 'error'); }
  };

  const handleSendChat = async (message) => {
    if (!selected) return;
    try {
      await api.post(`/incidents/${selected._id}/chat`, { message, senderRole: user.role });
      if (socket) socket.emit('chat:send', { incidentId: selected._id, message, senderRole: user.role });
    } catch (err) { showToast('Failed to send', 'error'); }
  };

  const filteredIncidents = incidents.filter(i => {
    if (tab === 'pending') return i.status === 'pending';
    if (tab === 'active') return ['assigned', 'en_route', 'on_site'].includes(i.status);
    if (tab === 'resolved') return i.status === 'resolved' || i.status === 'dismissed';
    return true;
  });

  return (
    <div className="active-incidents-page">
      <ReliefNavbar />
      <main className="active-incidents-content">
        <h1 className="text-heading page-title">🚨 ACTIVE INCIDENTS</h1>
        <div className="incident-tabs">
          {['pending', 'active', 'resolved', 'all'].map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} tab-btn`} onClick={() => setTab(t)}>
              {t.toUpperCase()} {t !== 'all' && <span className="tab-count">{incidents.filter(i => t === 'pending' ? i.status === 'pending' : t === 'active' ? ['assigned','en_route','on_site'].includes(i.status) : t === 'resolved' ? ['resolved','dismissed'].includes(i.status) : true).length}</span>}
            </button>
          ))}
        </div>

        <div className="incidents-layout">
          <div className="incidents-list-col">
            {loading ? <SkeletonLoader lines={5} /> : filteredIncidents.length === 0 ? (
              <div className="empty-state">No incidents in this category</div>
            ) : (
              filteredIncidents.map(inc => (
                <IncidentCard key={inc._id} incident={inc} onClick={() => handleSelect(inc)} actions={
                  <>
                    {inc.status === 'pending' && <button className="btn btn-primary" onClick={() => handleAccept(inc)}>ACCEPT</button>}
                    {inc.status === 'pending' && <button className="btn btn-ghost" onClick={() => handleDismiss(inc)}>DISMISS</button>}
                    {inc.status === 'assigned' && <button className="btn btn-warning" onClick={() => handleUpdateStatus(inc, 'en_route')}>MARK EN ROUTE</button>}
                    {['en_route', 'on_site'].includes(inc.status) && <button className="btn btn-success" onClick={() => handleUpdateStatus(inc, 'resolved')}>MARK RESOLVED</button>}
                  </>
                } />
              ))
            )}
          </div>

          {selected && (
            <div className="incident-detail-col">
              <IncidentDetail incident={selected} onClose={() => setSelected(null)}>
                <div style={{ width: '100%' }}>
                  <h3 className="text-heading" style={{ fontSize: 13, marginBottom: 8 }}>💬 INCIDENT CHAT</h3>
                  <ChatThread messages={chatMessages} onSend={handleSendChat} />
                </div>
              </IncidentDetail>
            </div>
          )}
        </div>
      </main>
      <BottomTabBar role="relief_admin" />
    </div>
  );
}
