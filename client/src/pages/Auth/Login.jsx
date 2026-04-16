import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Common/Toast';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { showToast('Fill all fields', 'error'); return; }
    setLoading(true);
    try {
      const user = await login(email, password);
      showToast(`Welcome back, ${user.name}!`, 'success');
      const routes = { user: '/user/home', relief_admin: '/relief/dashboard', field_unit: '/field/mission' };
      navigate(routes[user.role] || '/');
    } catch (err) {
      showToast(err.response?.data?.error || 'Login failed', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <span className="auth-logo">🚦</span>
          <h1 className="text-heading auth-title">NEXUSTRAFFIC</h1>
          <p className="auth-subtitle">Traffic & Accident Management System</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input id="login-email" className="input-field" type="email" placeholder="agent@nexustraffic.io" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input id="login-password" className="input-field" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button id="login-submit" className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? 'AUTHENTICATING...' : 'LOGIN'}
          </button>
        </form>
        <p className="auth-footer">Don't have an account? <Link to="/register">Register</Link></p>
      </div>
    </div>
  );
}
