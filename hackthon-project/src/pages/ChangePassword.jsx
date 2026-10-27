import { useState } from 'react';
import api from '../api/axios';
import { errText } from './ui';

export default function ChangePassword({ onDone, onLogout }) {
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const change = (e) => setF({ ...f, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.newPassword.length < 6) return setErr('New password must be at least 6 characters');
    if (f.newPassword !== f.confirm) return setErr('Passwords do not match');
    if (f.newPassword === f.currentPassword) return setErr('New password must be different');
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      onDone();
    } catch (e2) {
      setErr(errText(e2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <small>FIRST SIGN-IN</small>
        <h1>HCM Lite</h1>
        <p>For your security, please set a new password before you continue.</p>
      </div>
      <form className="login-card" onSubmit={submit}>
        <h2>Change password</h2>
        <label>Temporary password</label>
        <input name="currentPassword" type="password" value={f.currentPassword} onChange={change} />
        <label>New password</label>
        <input name="newPassword" type="password" value={f.newPassword} onChange={change} />
        <label>Confirm new password</label>
        <input name="confirm" type="password" value={f.confirm} onChange={change} />
        {err && <p className="err">{err}</p>}
        <button className="btn-main" disabled={loading}>{loading ? 'Please wait...' : 'Save password'}</button>
        <button type="button" className="logout" style={{ marginTop: 10, color: '#1f2a44', background: '#e2e8f0' }} onClick={onLogout}>Logout</button>
      </form>
    </div>
  );
}