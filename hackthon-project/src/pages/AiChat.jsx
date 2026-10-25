import { useState } from 'react';
import api from '../api/axios';
import { card, input, btn, errText } from './ui';

const Tag = () => <span style={{ fontSize: 11, color: '#5b4bc4', fontWeight: 700 }}>AI-generated</span>;

function Chat() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const q = text.trim();
    if (!q || loading) return;
    setText('');
    setMsgs((m) => [...m, { from: 'me', text: q }]);
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', { message: q });
      setMsgs((m) => [...m, { from: 'ai', text: data.answer }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: 'err', text: errText(e) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={card}>
      <h3>Ask the assistant</h3>
      <div style={{ minHeight: 120, maxHeight: 340, overflowY: 'auto', marginBottom: 10 }}>
        {msgs.length === 0 && <p style={{ color: '#64748b' }}>Try: "How many employees are active?" or "What is the late policy?"</p>}
        {msgs.map((m, i) => (
          <div key={i} style={{ margin: '8px 0', textAlign: m.from === 'me' ? 'right' : 'left' }}>
            <div style={{
              display: 'inline-block', maxWidth: '85%', padding: '8px 12px', borderRadius: 12, whiteSpace: 'pre-wrap', textAlign: 'left',
              background: m.from === 'me' ? '#0d9488' : m.from === 'err' ? '#fee2e2' : '#ede9fe',
              color: m.from === 'me' ? '#fff' : '#1f2a44',
            }}>
              {m.text}
            </div>
            {m.from === 'ai' && <div><Tag /></div>}
          </div>
        ))}
        {loading && <p style={{ color: '#64748b' }}>Thinking...</p>}
      </div>
      <input
        style={{ ...input, width: '70%' }}
        value={text}
        placeholder="Type your question"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
      />
      <button style={btn} disabled={loading} onClick={send}>Send</button>
    </div>
  );
}

function SmartLeave() {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const fill = async () => {
    setMsg('');
    setDraft(null);
    if (!text.trim()) return setMsg('Please type your leave request');
    setLoading(true);
    try {
      const { data } = await api.post('/ai/smart-leave', { text });
      setDraft(data);
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setMsg('');
    setLoading(true);
    try {
      await api.post('/leaves', { type: draft.type, startDate: draft.start, endDate: draft.end, reason: draft.reason });
      setMsg('Leave requested. Check "My Work" for status.');
      setDraft(null);
      setText('');
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <div style={card}>
      <h3>Smart leave</h3>
      <input
        style={{ ...input, width: '70%' }}
        value={text}
        placeholder='e.g. "I need next Monday and Tuesday off for my sister wedding"'
        onChange={(e) => setText(e.target.value)}
      />
      <button style={btn} disabled={loading} onClick={fill}>{loading ? 'Please wait...' : 'Fill form'}</button>
      {msg && <p style={{ color: '#b45309', fontWeight: 'bold' }}>{msg}</p>}
      {draft && (
        <div style={{ marginTop: 10 }}>
          <Tag /> Check the details, then confirm. Nothing is saved until you press Confirm.
          <div style={{ marginTop: 8 }}>
            <select style={input} value={draft.type} onChange={set('type')}>
              <option value="annual">Annual</option>
              <option value="sick">Sick</option>
              <option value="casual">Casual</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <input style={input} type="date" value={draft.start} onChange={set('start')} />
            <input style={input} type="date" value={draft.end} onChange={set('end')} />
            <input style={input} value={draft.reason} onChange={set('reason')} />
            <button style={btn} disabled={loading} onClick={confirm}>Confirm and apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary() {
  const [out, setOut] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setMsg('');
    setOut('');
    setLoading(true);
    try {
      const kpi = (await api.get('/dashboard')).data;
      const { data } = await api.post('/ai/summary', { kpi });
      setOut(data.answer);
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={card}>
      <h3>Dashboard summary</h3>
      <button style={btn} disabled={loading} onClick={run}>{loading ? 'Please wait...' : 'Summarize'}</button>
      {msg && <p style={{ color: '#b45309', fontWeight: 'bold' }}>{msg}</p>}
      {out && (
        <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
          {out}
          <div><Tag /></div>
        </div>
      )}
    </div>
  );
}

export default function AiChat({ role }) {
  return (
    <div>
      <Chat />
      {role === 'employee' && <SmartLeave />}
      {(role === 'hr' || role === 'admin') && <Summary />}
    </div>
  );
}