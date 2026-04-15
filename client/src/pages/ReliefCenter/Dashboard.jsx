import React, { useState, useEffect } from 'react';
import ReliefNavbar from '../../components/Navbar/ReliefNavbar';
import BottomTabBar from '../../components/BottomTabBar/BottomTabBar';
import StatChip from '../../components/Common/StatChip';
import HeatmapGrid from '../../components/Common/HeatmapGrid';
import LiveBadge from '../../components/Common/LiveBadge';
import StatusToggle from '../../components/Common/StatusToggle';
import SkeletonLoader from '../../components/Common/SkeletonLoader';
import IncidentCard from '../../components/IncidentCard/IncidentCard';
import { useSocket } from '../../context/SocketContext';
import { getCurrentISTTime } from '../../utils/timeUtils';
import { showToast } from '../../components/Common/Toast';
import api from '../../services/api';
import './Dashboard.css';

export default function Dashboard() {
  const socket = useSocket();
  const [stats, setStats] = useState({ total: 0, active: 0, critical: 0, resolved: 0, today: 0 });
  const [heatmap, setHeatmap] = useState([]);
  const [recent, setRecent] = useState([]);
  const [clock, setClock] = useState(getCurrentISTTime());
  const [onDuty, setOnDuty] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
    const clockInterval = setInterval(() => setClock(getCurrentISTTime()), 1000);
    if (socket) {
      socket.on('incident:new', () => loadDashboard());
      socket.on('incident:updated', () => loadDashboard());
    }
    return () => { clearInterval(clockInterval); if (socket) { socket.off('incident:new'); socket.off('incident:updated'); } };
  }, [socket]);

  const loadDashboard = async () => {
    try {
      const [statsRes, heatRes, incRes] = await Promise.all([
        api.get('/incidents/stats'), api.get('/incidents/heatmap'), api.get('/incidents'),
      ]);
      setStats(statsRes.data);
      setHeatmap(heatRes.data);
      setRecent(incRes.data.slice(0, 5));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const toggleDuty = async () => {
    try {
      const newStatus = onDuty ? 'off_duty' : 'on_duty';
      setOnDuty(!onDuty);
      showToast(`Center ${!onDuty ? 'ON' : 'OFF'} duty`, onDuty ? 'warning' : 'success');
    } catch (err) { showToast('Failed to toggle', 'error'); }
  };

  return (
    <div className="relief-dashboard-page">
      <ReliefNavbar />
      <main className="relief-dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="text-heading dashboard-title">COMMAND CENTER</h1>
            <div className="dashboard-meta">
              <LiveBadge /> <span className="text-mono dashboard-clock">{clock}</span>
            </div>
          </div>
          <StatusToggle isOn={onDuty} onToggle={toggleDuty} />
        </div>

        <div className="dashboard-stats">
          <StatChip label="Total Incidents" value={stats.total} color="var(--color-info)" icon="📊" />
          <StatChip label="Active" value={stats.active} color="var(--color-critical)" icon="🔴" />
          <StatChip label="Critical" value={stats.critical} color="var(--color-critical)" icon="⚠️" />
          <StatChip label="Resolved" value={stats.resolved} color="var(--color-resolved)" icon="✅" />
          <StatChip label="Today" value={stats.today} color="var(--color-medium)" icon="📅" />
        </div>

        <div className="dashboard-grid">
          <section className="dashboard-section">
            <h2 className="section-title text-heading">🗺️ HEATMAP</h2>
            <div className="card" style={{ padding: 16 }}>
              {loading ? <SkeletonLoader lines={3} /> : <HeatmapGrid data={heatmap} />}
            </div>
          </section>

          <section className="dashboard-section">
            <h2 className="section-title text-heading">🚨 RECENT INCIDENTS</h2>
            {loading ? <SkeletonLoader lines={4} /> : recent.length === 0 ? (
              <div className="empty-state">No recent incidents</div>
            ) : (
              <div className="recent-list">{recent.map(inc => <IncidentCard key={inc._id} incident={inc} />)}</div>
            )}
          </section>
        </div>
      </main>
      <BottomTabBar role="relief_admin" />
    </div>
  );
}
