import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrafficCone, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Common/Toast';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const validatePassword = (pwd) => {
    if (!pwd) { setPasswordError(''); return; }
    if (pwd.length < 8) { setPasswordError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'); return; }
    if (!/[A-Z]/.test(pwd)) { setPasswordError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'); return; }
    if (!/[a-z]/.test(pwd)) { setPasswordError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'); return; }
    if (!/[0-9]/.test(pwd)) { setPasswordError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) { setPasswordError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'); return; }
    setPasswordError('');
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    validatePassword(val);
  };

  // Load remembered credentials on mount
  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUser');
    if (remembered) {
      try {
        const { email: savedEmail } = JSON.parse(remembered);
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (_) { /* ignore */ }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { showToast('Fill all fields', 'error'); return; }
    if (passwordError) { return; }
    setLoading(true);
    try {
      const user = await login(email, password);
      // Save or clear remembered credentials
      if (rememberMe) {
        localStorage.setItem('rememberedUser', JSON.stringify({ email }));
      } else {
        localStorage.removeItem('rememberedUser');
      }
      showToast(`Welcome back, ${user.name}!`, 'success');
      const routes = { user: '/user/home', relief_admin: '/relief/dashboard', field_unit: '/field/mission' };
      navigate(routes[user.role] || '/');
    } catch (err) {
      showToast(err.response?.data?.error || 'Login failed', 'error');
    } finally { setLoading(false); }
  };

  const handleForgotPassword = () => {
    showToast('Password reset is not available in this version', 'info');
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <span className="auth-logo"><TrafficCone size={48} style={{ color: 'inherit' }} /></span>
          <h1 className="text-heading auth-title">NEXUSTRAFFIC</h1>
          <p className="auth-subtitle">Traffic & Accident Management System</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {passwordError && <div className="auth-error-banner">{passwordError}</div>}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input id="login-email" className="input-field" type="email" placeholder="agent@nexustraffic.io" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-input-wrapper">
              <input id="login-password" className="input-field" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={handlePasswordChange} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
              </button>
            </div>
          </div>
          <div className="login-options">
            <label className="remember-me">
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
              <span className="remember-checkbox"></span>
              <span className="remember-label">Remember me</span>
            </label>
            <button type="button" className="forgot-password" onClick={handleForgotPassword}>Forgot your password?</button>
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
