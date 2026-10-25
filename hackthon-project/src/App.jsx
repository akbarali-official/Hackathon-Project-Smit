import { useEffect, useState } from 'react';
import api from './api/axios';
import AdminPanel from './pages/AdminPanel';
import HRPanel from './pages/HRPanel';
import EmployeePanel from './pages/employeePanel';
import Dashboard from './pages/Dashboard';
import PayrollPanel from './pages/payrollPanel';
import AiChat from './pages/AiChat';

const MAIN_LABEL = { admin: 'Users & Access', hr: 'People Operations', employee: 'My Work' };

export default function App() {
  const [user, setUser] = useState(null);
  const [setupDone, setSetupDone] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved && localStorage.getItem('token')) setUser(JSON.parse(saved));
    api.get('/auth/status')
      .then((r) => setSetupDone(r.data.setupDone))
      .catch(() => setError('Server se connect nahi ho pa raha'));
  }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) return setError('Email and password are required');
    setLoading(true);
    try {
      const { data } = await api.post(setupDone ? '/auth/login' : '/auth/setup', form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setSetupDone(true);
      setPage('dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  if (user) {
    const items = [
      ['dashboard', 'Dashboard'],
      ['main', MAIN_LABEL[user.role]],
      ['payroll', user.role === 'employee' ? 'Payslips' : 'Payroll'],
      ['ai', 'AI Assistant'],
    ];
    return (
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">HCM <span>Lite</span></div>
          {items.map(([k, label]) => (
            <button key={k} className={'menu-item' + (page === k ? ' active' : '')} onClick={() => setPage(k)}>{label}</button>
          ))}
          <div className="side-foot">
            <div>{user.name}</div>
            <span className={'role-pill ' + user.role}>{user.role}</span>
            <button className="logout" onClick={logout}>Logout</button>
          </div>
        </aside>
        <main className="main">
          <h2 className="page-title">{items.find((i) => i[0] === page)[1]}</h2>
          {page === 'dashboard' && <Dashboard />}
          {page === 'main' && user.role === 'admin' && <AdminPanel />}
          {page === 'main' && user.role === 'hr' && <HRPanel />}
          {page === 'main' && user.role === 'employee' && <EmployeePanel />}
          {page === 'payroll' && <PayrollPanel role={user.role} />}
          {page === 'ai' && <AiChat role={user.role} />}
        </main>
      </div>
    );
  }

  if (setupDone === null && !error) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <small>SAYLANI HACKATHON</small>
        <h1>HCM Lite</h1>
        <p>AI-assisted Human Capital Management for Admin, HR and Employees</p>
        <div className="chips">
          <span style={{ background: '#fff', color: '#1f2a44' }}>Admin</span>
          <span style={{ background: '#0d9488' }}>HR</span>
          <span style={{ background: '#e8962e' }}>Employee</span>
        </div>
      </div>
      <form className="login-card" onSubmit={submit}>
        <h2>{setupDone ? 'Sign in' : 'First-run setup'}</h2>
        {!setupDone && (
          <>
            <label>Company name</label>
            <input name="companyName" value={form.companyName} onChange={change} />
            <label>Your name</label>
            <input name="name" value={form.name} onChange={change} />
          </>
        )}
        <label>Email</label>
        <input name="email" type="email" value={form.email} onChange={change} />
        <label>Password</label>
        <input name="password" type="password" value={form.password} onChange={change} />
        {error && <p className="err">{error}</p>}
        <button className="btn-main" disabled={loading}>
          {loading ? 'Please wait...' : setupDone ? 'Login' : 'Create Admin'}
        </button>
      </form>
    </div>
  );
}