import React, { useState, useEffect } from 'react';
import ReliefNavbar from '../../components/Navbar/ReliefNavbar';
import BottomTabBar from '../../components/BottomTabBar/BottomTabBar';
import StatusToggle from '../../components/Common/StatusToggle';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Common/Toast';
import api from '../../services/api';
import './ReliefProfile.css';

export default function ReliefProfile() {
  const { user, logout } = useAuth();
  const [prefs, setPrefs] = useState({ notifications: true, smsUpdates: false, soundAlerts: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.preferences) setPrefs(prev => ({ ...prev, ...user.preferences }));
  }, [user]);

  const handleToggle = async (key) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSaving(true);
    try {
      await api.patch('/users/preferences', newPrefs);
      showToast('Preferences updated', 'success');
    } catch (err) { showToast('Failed to save', 'error'); setPrefs(prefs); } finally { setSaving(false); }
  };

  return (
    <div className="relief-profile-page">
      <ReliefNavbar />
      <main className="relief-profile-content">
        <div className="relief-profile-card card">
          <div className="relief-profile-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <h1 className="text-heading relief-profile-name">{user?.name?.toUpperCase()}</h1>
          <span className="text-mono relief-profile-email">{user?.email}</span>
          <span className="badge-pill relief-profile-role">{user?.role?.replace('_', ' ')?.toUpperCase()}</span>
        </div>

        <div className="relief-profile-section card">
          <h2 className="section-title text-heading">⚙️ PREFERENCES</h2>
          <div className="pref-item">
            <div>
              <span className="pref-label">Push Notifications</span>
              <span className="pref-desc">Receive alerts for incoming incidents</span>
            </div>
            <StatusToggle isOn={prefs.notifications} onToggle={() => handleToggle('notifications')} labelOn="ON" labelOff="OFF" disabled={saving} />
          </div>
          <div className="pref-item">
            <div>
              <span className="pref-label">SMS Updates</span>
              <span className="pref-desc">Get critical alerts via SMS</span>
            </div>
            <StatusToggle isOn={prefs.smsUpdates} onToggle={() => handleToggle('smsUpdates')} labelOn="ON" labelOff="OFF" disabled={saving} />
          </div>
          <div className="pref-item">
            <div>
              <span className="pref-label">Sound Alerts</span>
              <span className="pref-desc">Play sound for new incidents</span>
            </div>
            <StatusToggle isOn={prefs.soundAlerts} onToggle={() => handleToggle('soundAlerts')} labelOn="ON" labelOff="OFF" disabled={saving} />
          </div>
        </div>

        <div className="relief-profile-section card">
          <h2 className="section-title text-heading">🔒 ACCOUNT</h2>
          <button className="btn btn-danger relief-logout-btn" onClick={logout}>LOGOUT</button>
        </div>
      </main>
      <BottomTabBar role="relief_admin" />
    </div>
  );
}
