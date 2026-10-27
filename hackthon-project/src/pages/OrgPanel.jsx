import { useEffect, useState } from 'react';
import api from '../api/axios';
import { card, input, btn, btnRed, errText } from './ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function OrgPanel({ role }) {
  const edit = role === 'admin';
  const [s, setS] = useState(null);
  const [depts, setDepts] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [deptName, setDeptName] = useState('');
  const [hol, setHol] = useState({ date: '', name: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const res = await Promise.allSettled([api.get('/org/settings'), api.get('/org/departments'), api.get('/org/holidays')]);
    if (res[0].status === 'fulfilled') setS(res[0].value.data);
    if (res[1].status === 'fulfilled') setDepts(res[1].value.data);
    if (res[2].status === 'fulfilled') setHolidays(res[2].value.data);
    if (res.some((r) => r.status === 'rejected')) setMsg('Some data could not be loaded. Please refresh.');
  };
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const toggleDay = (i) => {
    const w = s.weekend || [];
    setS({ ...s, weekend: w.includes(i) ? w.filter((x) => x !== i) : [...w, i] });
  };

  const here = () => {
    if (!navigator.geolocation) return setMsg('Location is not supported in this browser');
    navigator.geolocation.getCurrentPosition(
      (p) => setS({ ...s, officeLat: p.coords.latitude.toFixed(6), officeLng: p.coords.longitude.toFixed(6) }),
      () => setMsg('Could not read your location. Please allow location access.')
    );
  };

  const save = async () => {
    setMsg('');
    setLoading(true);
    try {
      const { data } = await api.put('/org/settings', s);
      setS(data);
      setMsg('Settings saved. New records will use these rules.');
    } catch (e) { setMsg(errText(e)); }
    finally { setLoading(false); }
  };

  const call = async (fn) => {
    setMsg('');
    try { await fn(); await load(); } catch (e) { setMsg(errText(e)); }
  };

  if (!s) return <div style={card}>{msg || 'Loading...'}</div>;

  return (
    <div>
      {msg && <p style={{ color: '#b45309', fontWeight: 'bold' }}>{msg}</p>}

      <div style={card}>
        <h3>Company settings {!edit && '(view only)'}</h3>
        <label>Company name</label><br />
        <input style={input} disabled={!edit} value={s.companyName || ''} onChange={set('companyName')} /><br />
        <label>Office start (HH:MM)</label><br />
        <input style={input} disabled={!edit} value={s.officeStart || ''} onChange={set('officeStart')} /><br />
        <label>Grace time (minutes)</label><br />
        <input style={input} disabled={!edit} type="number" value={s.graceMinutes ?? ''} onChange={set('graceMinutes')} /><br />
        <label>Half day if worked under (hours)</label><br />
        <input style={input} disabled={!edit} type="number" value={s.halfDayHours ?? ''} onChange={set('halfDayHours')} /><br />
        <label>Weekend</label><br />
        {DAYS.map((d, i) => (
          <label key={d} style={{ marginRight: 12 }}>
            <input type="checkbox" disabled={!edit} checked={(s.weekend || []).includes(i)} onChange={() => toggleDay(i)} /> {d}
          </label>
        ))}
        <br />
        <label>Office location (for camera check-in later)</label><br />
        <input style={input} disabled={!edit} placeholder="Latitude" value={s.officeLat ?? ''} onChange={set('officeLat')} />
        <input style={input} disabled={!edit} placeholder="Longitude" value={s.officeLng ?? ''} onChange={set('officeLng')} />
        <input style={input} disabled={!edit} type="number" placeholder="Radius (m)" value={s.officeRadius ?? ''} onChange={set('officeRadius')} /><br />
        {edit && (
          <>
            <button style={btn} onClick={here}>Use my current location</button>
            <button style={btn} disabled={loading} onClick={save}>{loading ? 'Saving...' : 'Save settings'}</button>
          </>
        )}
      </div>

      <div style={card}>
        <h3>Departments ({depts.length})</h3>
        {edit && (
          <div>
            <input style={input} placeholder="Department name" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
            <button style={btn} onClick={() => call(async () => { await api.post('/org/departments', { name: deptName }); setDeptName(''); })}>Add</button>
          </div>
        )}
        {depts.length === 0 && <p>No departments yet</p>}
        {depts.map((d) => (
          <div key={d._id} style={{ padding: '4px 0' }}>
            {d.name}
            {edit && <button style={{ ...btnRed, marginLeft: 10 }} onClick={() => call(() => api.delete(`/org/departments/${d._id}`))}>Delete</button>}
          </div>
        ))}
      </div>

      <div style={card}>
        <h3>Public holidays ({holidays.length})</h3>
        {edit && (
          <div>
            <input style={input} type="date" value={hol.date} onChange={(e) => setHol({ ...hol, date: e.target.value })} />
            <input style={input} placeholder="Holiday name" value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} />
            <button style={btn} onClick={() => call(async () => { await api.post('/org/holidays', hol); setHol({ date: '', name: '' }); })}>Add</button>
          </div>
        )}
        {holidays.length === 0 && <p>No holidays yet</p>}
        {holidays.map((h) => (
          <div key={h._id} style={{ padding: '4px 0' }}>
            {h.date}: {h.name}
            {edit && <button style={{ ...btnRed, marginLeft: 10 }} onClick={() => call(() => api.delete(`/org/holidays/${h._id}`))}>Delete</button>}
          </div>
        ))}
      </div>
    </div>
  );
}