import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Auth pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

// User pages
import UserHome from './pages/User/Home';
import MyReports from './pages/User/MyReports';
import UserAlerts from './pages/User/Alerts';
import UserProfile from './pages/User/Profile';

// Relief Center pages
import ReliefDashboard from './pages/ReliefCenter/Dashboard';
import ActiveIncidents from './pages/ReliefCenter/ActiveIncidents';
import ReliefAlerts from './pages/ReliefCenter/ReliefAlerts';
import ReliefReports from './pages/ReliefCenter/Reports';

// Field Unit pages
import MyMission from './pages/FieldUnit/MyMission';
import FieldIncidents from './pages/FieldUnit/FieldIncidents';
import Updates from './pages/FieldUnit/Updates';
import FieldProfile from './pages/FieldUnit/FieldProfile';

// Toast
import Toast from './components/Common/Toast';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="skeleton" style={{ width: 200, height: 20, margin: '40vh auto' }} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const redirectMap = { user: '/user/home', relief_admin: '/relief/dashboard', field_unit: '/field/mission' };
    return <Navigate to={redirectMap[user.role] || '/login'} replace />;
  }
  return children;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const redirectMap = { user: '/user/home', relief_admin: '/relief/dashboard', field_unit: '/field/mission' };
  return <Navigate to={redirectMap[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <>
      <Toast />
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* User routes */}
        <Route path="/user/home" element={<ProtectedRoute allowedRoles={['user']}><UserHome /></ProtectedRoute>} />
        <Route path="/user/reports" element={<ProtectedRoute allowedRoles={['user']}><MyReports /></ProtectedRoute>} />
        <Route path="/user/alerts" element={<ProtectedRoute allowedRoles={['user']}><UserAlerts /></ProtectedRoute>} />
        <Route path="/user/profile" element={<ProtectedRoute allowedRoles={['user']}><UserProfile /></ProtectedRoute>} />

        {/* Relief Center routes */}
        <Route path="/relief/dashboard" element={<ProtectedRoute allowedRoles={['relief_admin']}><ReliefDashboard /></ProtectedRoute>} />
        <Route path="/relief/incidents" element={<ProtectedRoute allowedRoles={['relief_admin']}><ActiveIncidents /></ProtectedRoute>} />
        <Route path="/relief/alerts" element={<ProtectedRoute allowedRoles={['relief_admin']}><ReliefAlerts /></ProtectedRoute>} />
        <Route path="/relief/reports" element={<ProtectedRoute allowedRoles={['relief_admin']}><ReliefReports /></ProtectedRoute>} />

        {/* Field Unit routes */}
        <Route path="/field/mission" element={<ProtectedRoute allowedRoles={['field_unit']}><MyMission /></ProtectedRoute>} />
        <Route path="/field/incidents" element={<ProtectedRoute allowedRoles={['field_unit']}><FieldIncidents /></ProtectedRoute>} />
        <Route path="/field/updates" element={<ProtectedRoute allowedRoles={['field_unit']}><Updates /></ProtectedRoute>} />
        <Route path="/field/profile" element={<ProtectedRoute allowedRoles={['field_unit']}><FieldProfile /></ProtectedRoute>} />

        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </>
  );
}
