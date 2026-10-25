import { useEffect, useState } from 'react';
import api from '../api/axios';
import { card, input, btn, btnRed, errText } from './ui';

export default function EmployeePanel() {
  const [att, setAtt] = useState([]);
  const [data, setData] = useState({ balance: {}, leaves: [] });
  const [form, setForm] = useState({ type: 'casual', startDate: '', endDate: '', reason: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const [a, l] = await Promise.all([api.get('/attendance/me'), api.get('/leaves/me')]);
      setAtt(a.data);
      setData(l.data);
    } catch (e) { setMsg(errText(e)); }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn, ok) => {
    setMsg(''); setLoading(true);
    try { await fn(); setMsg(ok || ''); await load(); }
    catch (e) { setMsg(errText(e)); }
    finally { setLoading(false); }
  };

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <div>
      {msg && <p style={{ color: '#b45309' }}>{msg}</p>}

      <div style={card}>
        <h3>Attendance</h3>
        <button style={btn} disabled={loading} onClick={() => run(() => api.post('/attendance/check-in'), 'Checked in')}>Check in</button>
        <button style={btnRed} disabled={loading} onClick={() => run(() => api.post('/attendance/check-out'), 'Checked out')}>Check out</button>
        <table style={{ width: '100%', marginTop: 10 }}>
          <thead><tr><th align="left">Date</th><th align="left">Status</th><th align="left">Hours</th></tr></thead>
          <tbody>
            {att.length === 0 && <tr><td colSpan="3">No records yet</td></tr>}
            {att.map((r) => <tr key={r._id}><td>{r.date}</td><td>{r.status}</td><td>{r.hours}</td></tr>)}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <h3>Leave balance</h3>
        {Object.entries(data.balance).map(([k, v]) => (
          <span key={k} style={{ marginRight: 16 }}>{k}: <b>{v.left}</b> left</span>
        ))}
      </div>

      <div style={card}>
        <h3>Apply for leave</h3>
        <select style={input} name="type" value={form.type} onChange={change}>
          <option value="annual">Annual</option>
          <option value="sick">Sick</option>
          <option value="casual">Casual</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <input style={input} type="date" name="startDate" value={form.startDate} onChange={change} />
        <input style={input} type="date" name="endDate" value={form.endDate} onChange={change} />
        <input style={input} name="reason" placeholder="Reason" value={form.reason} onChange={change} />
        <button style={btn} disabled={loading} onClick={() => run(() => api.post('/leaves', form), 'Leave requested')}>Apply</button>
      </div>

      <div style={card}>
        <h3>My leaves</h3>
        {data.leaves.length === 0 && <p>No leave requests yet</p>}
        {data.leaves.map((l) => (
          <div key={l._id} style={{ marginBottom: 8 }}>
            {l.type}: {l.startDate} to {l.endDate} ({l.days} days) - <b>{l.status}</b> {l.comment && `(${l.comment})`}
            {l.status === 'pending' && (
              <button style={{ ...btnRed, marginLeft: 8 }} onClick={() => run(() => api.patch(`/leaves/${l._id}/cancel`))}>Cancel</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}