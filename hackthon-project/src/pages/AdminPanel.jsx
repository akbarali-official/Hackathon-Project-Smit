import { useEffect, useState } from 'react';
import api from '../api/axios';
import { card, input, btn, errText } from './ui';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');

  const load = () => api.get('/users').then((r) => setUsers(r.data)).catch((e) => setMsg(errText(e)));
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const create = async () => {
    setMsg('');
    try {
      await api.post('/users/hr', form);
      setMsg('HR login created');
      setForm({ name: '', email: '', password: '' });
      load();
    } catch (e) { setMsg(errText(e)); }
  };

  return (
    <div>
      {msg && <p style={{ color: '#b45309' }}>{msg}</p>}
      <div style={card}>
        <h3>Create HR login</h3>
        <input style={input} name="name" placeholder="Name" value={form.name} onChange={change} />
        <input style={input} name="email" placeholder="Email" value={form.email} onChange={change} />
        <input style={input} name="password" type="password" placeholder="Password" value={form.password} onChange={change} />
        <button style={btn} onClick={create}>Create</button>
      </div>
      <div style={card}>
        <h3>All users ({users.length})</h3>
        {users.map((u) => <div key={u._id}>{u.name} - {u.email} - {u.role}</div>)}
      </div>
    </div>
  );
}