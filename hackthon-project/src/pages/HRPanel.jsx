import { useEffect, useState } from 'react';
import api from '../api/axios';
import { card, input, btn, btnRed, errText } from './ui';

const empty = { code: '', name: '', email: '', department: '', designation: '', basicSalary: '' };

export default function HRPanel() {
  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [board, setBoard] = useState({ date: '', records: [] });
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const [e, i, b] = await Promise.all([api.get('/employees'), api.get('/leaves'), api.get('/attendance/board')]);
      setEmployees(e.data.items);
      setInbox(i.data);
      setBoard(b.data);
    } catch (e) { setMsg(errText(e)); }
  };
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addEmployee = async () => {
    setMsg(''); setLoading(true);
    try {
      const { data } = await api.post('/employees', form);
      setMsg(`Employee created. Temporary password: ${data.tempPassword} (give it to ${data.employee.name})`);
      setForm(empty);
      await load();
    } catch (e) { setMsg(errText(e)); }
    finally { setLoading(false); }
  };

  const decide = async (id, decision) => {
    const comment = window.prompt('Comment (optional)') || '';
    try {
      await api.patch(`/leaves/${id}/decision`, { decision, comment });
      await load();
    } catch (e) { setMsg(errText(e)); }
  };

  return (
    <div>
      <div>
        <button style={btn} onClick={() => setTab('employees')}>Employees</button>
        <button style={btn} onClick={() => setTab('leaves')}>Leave inbox ({inbox.length})</button>
        <button style={btn} onClick={() => setTab('board')}>Attendance board</button>
      </div>
      {msg && <p style={{ color: '#b45309', fontWeight: 'bold' }}>{msg}</p>}

      {tab === 'employees' && (
        <>
          <div style={card}>
            <h3>Register employee</h3>
            {['code', 'name', 'email', 'department', 'designation', 'basicSalary'].map((f) => (
              <input key={f} style={input} name={f} placeholder={f} value={form[f]} onChange={change} />
            ))}
            <button style={btn} disabled={loading} onClick={addEmployee}>{loading ? 'Saving...' : 'Register'}</button>
          </div>
          <div style={card}>
            <h3>Employees ({employees.length})</h3>
            {employees.length === 0 && <p>No employees yet</p>}
            {employees.map((e) => (
              <div key={e._id}>{e.code} - {e.name} - {e.department} - {e.designation} - {e.email}</div>
            ))}
          </div>
        </>
      )}

      {tab === 'leaves' && (
        <div style={card}>
          <h3>Pending leave requests</h3>
          {inbox.length === 0 && <p>Nothing pending</p>}
          {inbox.map((l) => (
            <div key={l._id} style={{ marginBottom: 10 }}>
              {l.employeeId?.name}: {l.type}, {l.startDate} to {l.endDate} ({l.days} days) - {l.reason}
              <div>
                <button style={btn} onClick={() => decide(l._id, 'approved')}>Approve</button>
                <button style={btnRed} onClick={() => decide(l._id, 'rejected')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'board' && (
        <div style={card}>
          <h3>Attendance on {board.date}</h3>
          {board.records.length === 0 && <p>No check-ins today</p>}
          {board.records.map((r) => (
            <div key={r._id}>{r.employeeId?.name} - {r.status} - {r.hours} h</div>
          ))}
        </div>
      )}
    </div>
  );
}