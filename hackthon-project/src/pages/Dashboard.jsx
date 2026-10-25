import { useEffect, useState } from 'react';
import api from '../api/axios';
import { card, errText } from './ui';

const COLORS = ['#0d9488', '#e8962e', '#5b4bc4', '#0d9488', '#e8962e'];

function Kpi({ label, value, color }) {
  return (
    <div style={{ flex: '1 1 140px', background: '#f4f6fa', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#64748b' }}>{label}</div>
    </div>
  );
}

export default function Dashboard({ refreshKey }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/dashboard').then((r) => setD(r.data)).catch((e) => setErr(errText(e)));
  }, [refreshKey]);

  if (err) return <div style={card}>{err}</div>;
  if (!d) return <div style={card}>Loading dashboard...</div>;

  if (d.role === 'employee') {
    return (
      <div style={card}>
        <h3>My dashboard</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Kpi label="Hours this week (of 40)" value={d.hoursThisWeek} color="#0d9488" />
          <Kpi label="Late this month" value={d.lateThisMonth} color="#e8962e" />
          <Kpi label="Days present this month" value={d.daysPresentThisMonth} color="#5b4bc4" />
          <Kpi label="Pending leave requests" value={d.pendingLeaves} color="#0d9488" />
        </div>
      </div>
    );
  }

  const max = Math.max(...d.headcountByDepartment.map((x) => x.count), 1);

  return (
    <>
      <div style={card}>
        <h3>Overview ({d.date})</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Kpi label="Headcount" value={d.headcount} color="#0d9488" />
          <Kpi label="Present today" value={d.presentToday} color="#0d9488" />
          <Kpi label="On leave" value={d.onLeave} color="#e8962e" />
          <Kpi label="Late today" value={d.lateToday} color="#5b4bc4" />
          <Kpi label="Pending approvals" value={d.pendingApprovals} color="#e8962e" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '2 1 320px', margin: 0 }}>
          <h3>Headcount by department</h3>
          {d.headcountByDepartment.length === 0 && <div>No employees yet</div>}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 170 }}>
            {d.headcountByDepartment.map((x, i) => (
              <div key={x.department} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{x.count}</div>
                <div style={{ height: Math.max((x.count / max) * 120, 8), background: COLORS[i % 5], borderRadius: 6 }} />
                <div style={{ fontSize: 12, marginTop: 4 }}>{x.department}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card, flex: '1 1 220px', margin: 0 }}>
          <h3>Top late-comers</h3>
          {d.topLateComers.length === 0 && <div>No late arrivals</div>}
          {d.topLateComers.map((x) => (
            <div key={x.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{x.name}</span><b style={{ color: '#e8962e' }}>{x.count}</b>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}