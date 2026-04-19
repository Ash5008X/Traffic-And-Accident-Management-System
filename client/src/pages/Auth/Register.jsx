import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrafficCone, User, BarChart3, Target, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Common/Toast';
import './Register.css';

export default function Register() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const validatePasswords = (pwd, confirmPwd) => {
    if (!pwd) { setFormError(''); return; }
    if (pwd.length < 8) { setFormError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'); return; }
    if (!/[A-Z]/.test(pwd)) { setFormError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'); return; }
    if (!/[a-z]/.test(pwd)) { setFormError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'); return; }
    if (!/[0-9]/.test(pwd)) { setFormError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) { setFormError('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'); return; }
    if (confirmPwd && pwd !== confirmPwd) { setFormError('Passwords do not match.'); return; }
    setFormError('');
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    validatePasswords(val, confirmPassword);
  };

  const handleConfirmPasswordChange = (e) => {
    const val = e.target.value;
    setConfirmPassword(val);
    validatePasswords(password, val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName || !email || !password) { showToast('Fill all required fields', 'error'); return; }
    if (formError) { return; }
    if (password !== confirmPassword) { setFormError('Passwords do not match.'); return; }

    const fullName = lastName ? `${firstName} ${lastName}` : firstName;
    setLoading(true);
    try {
      const user = await register(fullName, email, password, role);
      showToast(`Welcome, ${user.name}!`, 'success');
      const routes = { user: '/user/home', relief_admin: '/relief/dashboard', field_unit: '/field/mission' };
      navigate(routes[user.role] || '/');
    } catch (err) {
      showToast(err.response?.data?.error || 'Registration failed', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-container register-container">
        <div className="auth-header">
          <span className="auth-logo"><TrafficCone size={48} style={{ color: 'inherit' }} /></span>
          <h1 className="text-heading auth-title">NEXUSTRAFFIC</h1>
          <p className="auth-subtitle">Create Your Account</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {formError && <div className="auth-error-banner">{formError}</div>}
          {/* First Name + Last Name (side by side) */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input id="register-firstname" className="input-field" type="text" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input id="register-lastname" className="input-field" type="text" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>

          {/* Age + Gender (side by side) */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Age</label>
              <input id="register-age" className="input-field" type="number" placeholder="Age" min="1" max="120" value={age} onChange={e => setAge(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select id="register-gender" className="input-field select-field" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="" disabled>Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* Phone Number */}
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input id="register-phone" className="input-field" type="tel" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input id="register-email" className="input-field" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          {/* Password with Show/Hide */}
          <div className="form-group">
            <label className="form-label">Password *</label>
            <div className="password-input-wrapper">
              <input id="register-password" className="input-field" type={showPassword ? 'text' : 'password'} placeholder="Enter password" value={password} onChange={handlePasswordChange} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
              </button>
            </div>
          </div>

          {/* Confirm Password with Show/Hide */}
          <div className="form-group">
            <label className="form-label">Confirm Password *</label>
            <div className="password-input-wrapper">
              <input id="register-confirm-password" className="input-field" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm password" value={confirmPassword} onChange={handleConfirmPasswordChange} />
            </div>
          </div>

          {/* Role Selector */}
          <div className="form-group">
            <label className="form-label">Role *</label>
            <div className="role-radios">
              {[{ value: 'user', label: 'User', icon: <User size={16} style={{ color: 'inherit' }} /> }, { value: 'relief_admin', label: 'Relief Admin', icon: <BarChart3 size={16} style={{ color: 'inherit' }} /> }, { value: 'field_unit', label: 'Field Unit', icon: <Target size={16} style={{ color: 'inherit' }} /> }].map(r => (
                <label key={r.value} className={`role-radio ${role === r.value ? 'selected' : ''}`}>
                  <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={e => setRole(e.target.value)} />
                  <span className="role-icon">{r.icon}</span>
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button id="register-submit" className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? 'CREATING ACCOUNT...' : 'REGISTER'}
          </button>
        </form>
        <p className="auth-footer">Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}
