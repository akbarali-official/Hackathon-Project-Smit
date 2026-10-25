import { useEffect, useState } from 'react';
import api from '../api/axios';
import { card, input, btn, errText } from './ui';

const money = (n) => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const printSlip = (s) => {
  const w = window.open('', '_blank');
  if (!w) return;
  const row = (a, b) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #ddd">${a}</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right">${b}</td></tr>`;
  w.document.write(`<html><head><title>Payslip ${s.month}</title></head>
  <body style="font-family:Arial;padding:30px;max-width:600px;margin:auto">
  <h2>${s.company || 'Company'}: Payslip</h2>
  <p>Month: <b>${s.month}</b><br/>Employee: <b>${s.name}</b> (${s.code})<br/>Department: ${s.department || '-'}</p>
  <table style="width:100%;border-collapse:collapse">
  ${row('Basic salary', money(s.basic))}
  ${row('Gross salary (basic + HRA 40% + medical 10%)', money(s.gross))}
  ${row('Payable days / working days', `${s.payableDays} / ${s.workingDays}`)}
  ${row('Gross payable', money(s.grossPayable))}
  ${row(`Deductions (absent ${s.absentDays}, unpaid ${s.unpaidDays}, half days ${s.halfDays})`, money(s.deductions))}
  ${row('Tax', money(s.tax))}
  ${row('<b>Net pay</b>', `<b>${money(s.net)}</b>`)}
  </table></body></html>`);
  w.document.close();
  w.focus();
  w.print();
};

export default function PayrollPanel({ role }) {
  const [month, setMonth] = useState(thisMonth());
  const [runDoc, setRunDoc] = useState(null);
  const [slips, setSlips] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRun = async (m) => {
    try {
      const { data } = await api.get(`/payroll/${m}`);
      setRunDoc(data);
    } catch (e) {
      setRunDoc(null);
      if (e.response?.status !== 404) setMsg(errText(e));
    }
  };

  useEffect(() => {
    setMsg('');
    if (role === 'employee') {
      api.get('/payroll/me/slips').then((r) => setSlips(r.data)).catch((e) => setMsg(errText(e)));
    } else {
      loadRun(month);
    }
  }, [month, role]);

  const act = async (fn, ok) => {
    setMsg('');
    setLoading(true);
    try {
      const { data } = await fn();
      setRunDoc(data);
      setMsg(ok);
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setLoading(false);
    }
  };

  if (role === 'employee') {
    return (
      <div style={card}>
        <h3>My payslips</h3>
        {msg && <p style={{ color: '#b45309' }}>{msg}</p>}
        {slips.length === 0 && <p>No payslips yet. They appear after Admin finalizes payroll.</p>}
        {slips.map((s) => (
          <div key={s.month} style={{ marginBottom: 8 }}>
            {s.month}: net pay <b>{money(s.net)}</b>
            <button style={{ ...btn, marginLeft: 10 }} onClick={() => printSlip(s)}>View / Print PDF</button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={card}>
      <h3>Payroll</h3>
      <input style={input} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      {role === 'hr' && (!runDoc || runDoc.status === 'draft') && (
        <button style={btn} disabled={loading} onClick={() => act(() => api.post('/payroll/run', { month }), 'Draft created')}>
          {loading ? 'Please wait...' : runDoc ? 'Re-run draft' : 'Run payroll draft'}
        </button>
      )}
      {role === 'admin' && runDoc && runDoc.status === 'draft' && (
        <button style={btn} disabled={loading} onClick={() => act(() => api.post(`/payroll/${month}/finalize`), 'Payroll finalized and locked')}>
          Finalize (lock)
        </button>
      )}
      {msg && <p style={{ color: '#b45309', fontWeight: 'bold' }}>{msg}</p>}

      {!runDoc && <p>No payroll run for {month} yet.</p>}
      {runDoc && (
        <>
          <p>Status: <b>{runDoc.status}</b> | Total gross: <b>{money(runDoc.totalGross)}</b> | Total net: <b>{money(runDoc.totalNet)}</b></p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th align="left">Code</th><th align="left">Name</th><th align="right">Gross</th>
                  <th align="right">Absent</th><th align="right">Unpaid</th><th align="right">Half</th>
                  <th align="right">Deductions</th><th align="right">Tax</th><th align="right">Net</th>
                </tr>
              </thead>
              <tbody>
                {runDoc.items.length === 0 && <tr><td colSpan="9">No employees in this run</td></tr>}
                {runDoc.items.map((i) => (
                  <tr key={i.code}>
                    <td>{i.code}</td><td>{i.name}</td><td align="right">{money(i.grossPayable)}</td>
                    <td align="right">{i.absentDays}</td><td align="right">{i.unpaidDays}</td><td align="right">{i.halfDays}</td>
                    <td align="right">{money(i.deductions)}</td><td align="right">{money(i.tax)}</td><td align="right"><b>{money(i.net)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}