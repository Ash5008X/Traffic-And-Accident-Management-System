import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, CheckCheck, BellOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import './UserNavbar.css';

export default function UserNavbar() {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const navigate = useNavigate();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const profileTimerRef = useRef(null);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (profileTimerRef.current) clearTimeout(profileTimerRef.current);
    };
  }, []);

  const handleProfileEnter = () => {
    if (profileTimerRef.current) clearTimeout(profileTimerRef.current);
    setProfileOpen(true);
  };

  const handleProfileLeave = () => {
    profileTimerRef.current = setTimeout(() => {
      setProfileOpen(false);
    }, 150);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <nav className="user-navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <span className="brand-nexus">NEXUS</span>
          <span className="brand-traffic">TRAFFIC</span>
        </div>
        <div className="navbar-links desktop-only">
          <NavLink to="/user/home" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Home</NavLink>
          <NavLink to="/user/reports" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>My Reports</NavLink>
          <NavLink to="/user/alerts" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Alerts</NavLink>
          <NavLink to="/user/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Profile</NavLink>
        </div>
        <div className="navbar-actions">

          {/* ── Notification Bell ── */}
          <div className="notif-wrapper" ref={notifRef}>
            <button
              className="navbar-bell"
              aria-label="Notifications"
              onClick={() => setNotifOpen(prev => !prev)}
            >
              <span className="bell-icon"><Bell size={16} style={{ color: 'inherit' }} /></span>
              {unreadCount > 0 && <span className="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>

            {notifOpen && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <span className="notif-title">Notifications</span>
                  {notifications.length > 0 && (
                    <button className="notif-mark-all" onClick={markAllRead}>
                      <CheckCheck size={13} />
                      Mark All as Read
                    </button>
                  )}
                </div>
                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">
                      <BellOff size={28} strokeWidth={1.5} />
                      <p>No notifications yet</p>
                      <span>You're all caught up!</span>
                    </div>
                  ) : (
                    notifications.slice(0, 20).map((n) => (
                      <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                        <div className={`notif-dot-indicator ${n.read ? 'read' : ''}`} />
                        <div className="notif-content">
                          <p className="notif-message">{n.message}</p>
                          <span className="notif-time">{formatTime(n.timestamp)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── User Profile Dropdown ── */}
          <div
            className="profile-wrapper"
            ref={profileRef}
            onMouseEnter={handleProfileEnter}
            onMouseLeave={handleProfileLeave}
          >
            <div className="navbar-avatar" title={user?.name || 'User'}>
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className={`profile-dropdown ${profileOpen ? 'open' : ''}`}>
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-avatar">
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="profile-dropdown-info">
                  <span className="profile-dropdown-name">{user?.name || 'User'}</span>
                  <span className="profile-dropdown-email">{user?.email || ''}</span>
                </div>
              </div>
              <div className="profile-dropdown-divider" />
              <NavLink to="/user/profile" className="profile-dropdown-item">
                <User size={14} />
                <span>My Profile</span>
              </NavLink>
              <div className="profile-dropdown-divider" />
              <button className="profile-dropdown-item logout" onClick={handleLogout}>
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
}
