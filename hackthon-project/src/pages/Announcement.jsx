import { useEffect, useState } from 'react';
import api from '../api/axios';
import { card, input, btn, errText } from './ui';

export default function Announcements({ role }) {
  const [list, setList] = useState([]);
  const [audit, setAudit] = useState([]);
  const [form, setForm] = useState({ title: '', body: '' });
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      setList((await api.get('/comms/announcements')).data);
      if (role === 'admin') setAudit((await api.get('/comms/audit')).data);
    } catch (e) { setMsg(errText(e)); }
  };
  useEffect(() => { load(); }, []);

  const post = async () => {
    setMsg('');
    try {
      await api.post('/comms/announcements', form);
      setForm({ title: '', body: '' });
      await load();
    } catch (e) { setMsg(errText(e)); }
  };

  return (
    <div>
      {msg && <p style={{ color: '#b45309' }}>{msg}</p>}
      {(role === 'hr' || role === 'admin') && (
        <div style={card}>
          <h3>Post announcement</h3>
          <input style={input} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input style={{ ...input, width: '50%' }} placeholder="Message" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <button style={btn} onClick={post}>Post</button>
        </div>
      )}
      <div style={card}>
        <h3>Announcements</h3>
        {list.length === 0 && <p>No announcements yet</p>}
        {list.map((a) => (
          <div key={a._id} style={{ marginBottom: 10 }}>
            <b>{a.title}</b> <span style={{ color: '#64748b', fontSize: 12 }}>by {a.postedBy} ({a.role}), {new Date(a.createdAt).toLocaleString()}</span>
            <div>{a.body}</div>
          </div>
        ))}
      </div>
      {role === 'admin' && (
        <div style={card}>
          <h3>Audit log</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%' }}>
              <thead><tr><th align="left">When</th><th align="left">Who</th><th align="left">Action</th><th align="left">Entity</th><th align="left">After</th></tr></thead>
              <tbody>
                {audit.length === 0 && <tr><td colSpan="5">No entries yet</td></tr>}
                {audit.map((x) => (
                  <tr key={x._id}>
                    <td>{new Date(x.createdAt).toLocaleString()}</td>
                    <td>{x.actorName} ({x.role})</td>
                    <td>{x.action}</td>
                    <td>{x.entity}</td>
                    <td style={{ fontSize: 12 }}>{x.after ? JSON.stringify(x.after) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}