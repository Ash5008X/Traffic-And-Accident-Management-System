import React, { useState, useEffect } from 'react';
import ReliefNavbar from '../../components/Navbar/ReliefNavbar';
import BottomTabBar from '../../components/BottomTabBar/BottomTabBar';
import SkeletonLoader from '../../components/Common/SkeletonLoader';
import { showToast } from '../../components/Common/Toast';
import { formatISTDate } from '../../utils/timeUtils';
import api from '../../services/api';
import './Reports.css';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ from: '', to: '', severity: '', status: '' });

  useEffect(() => { loadReports(); loadTeam(); }, []);

  const loadReports = async (params = {}) => {
    setLoading(true);
    try {
      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/reports?${query}`);
      setReports(res.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const loadTeam = async () => {
    try { const res = await api.get('/reports/team'); setTeam(res.data); } catch (err) { console.error(err); }
  };

  const handleFilter = () => {
    const params = {};
    if (filter.from) params.from = filter.from;
    if (filter.to) params.to = filter.to;
    if (filter.severity) params.severity = filter.severity;
    if (filter.status) params.status = filter.status;
    loadReports(params);
  };

  const handleExportPdf = async () => {
    try {
      const res = await api.get('/reports/export/pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'nexustraffic-report.txt';
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      showToast('Report downloaded', 'success');
    } catch (err) { showToast('Export failed', 'error'); }
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/reports/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'nexustraffic-report.csv';
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      showToast('CSV exported', 'success');
    } catch (err) { showToast('Export failed', 'error'); }
  };

  return (
    <div className="relief-reports-page">
      <ReliefNavbar />
      <main className="relief-reports-content">
        <h1 className="text-heading page-title">📑 REPORTS & ANALYTICS</h1>

        <div className="reports-filters card">
          <div className="filter-row">
            <div className="form-group">
              <label className="form-label">From</label>
              <input className="input-field" type="date" value={filter.from} onChange={e => setFilter(p => ({ ...p, from: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <input className="input-field" type="date" value={filter.to} onChange={e => setFilter(p => ({ ...p, to: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Severity</label>
              <select className="select-field" value={filter.severity} onChange={e => setFilter(p => ({ ...p, severity: e.target.value }))}>
                <option value="">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="select-field" value={filter.status} onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
                <option value="">All</option><option value="pending">Pending</option><option value="assigned">Assigned</option><option value="resolved">Resolved</option>
              </select>
            </div>
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" onClick={handleFilter}>APPLY FILTER</button>
            <button className="btn btn-ghost" onClick={handleExportPdf}>📄 EXPORT PDF</button>
            <button className="btn btn-ghost" onClick={handleExportCsv}>📊 EXPORT CSV</button>
          </div>
        </div>

        <div className="reports-grid">
          <section className="reports-section">
            <h2 className="section-title text-heading">INCIDENTS ({reports.length})</h2>
            {loading ? <SkeletonLoader lines={5} /> : (
              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead><tr><th>ID</th><th>Type</th><th>Severity</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r._id}>
                        <td className="text-mono">{r.incidentId}</td>
                        <td>{r.type}</td>
                        <td><span className={`badge-pill severity-${r.severity}`} style={{ fontSize: 10 }}>{r.severity}</span></td>
                        <td><span className={`badge-pill status-${r.status}`} style={{ fontSize: 10 }}>{r.status}</span></td>
                        <td className="text-mono">{formatISTDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="reports-section">
            <h2 className="section-title text-heading">👥 TEAM STATUS</h2>
            <div className="team-grid">
              {team.map((u, i) => (
                <div key={i} className="card team-card">
                  <span className="text-mono" style={{ fontSize: 11, color: 'var(--color-info)' }}>{u.unitId}</span>
                  <span className={`badge-pill status-${u.status?.replace('_', '-')}`} style={{ fontSize: 10 }}>{u.status}</span>
                  <span className="text-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Missions: {u.missionsToday}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <BottomTabBar role="relief_admin" />
    </div>
  );
}
