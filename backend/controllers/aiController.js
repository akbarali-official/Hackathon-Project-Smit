const AiLog = require('../models/AiLog');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/leave');
const PayrollRun = require('../models/PayrollRun');

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
const ACTIVE = { $in: ['active', 'probation'] };
const QUOTA = { annual: 14, sick: 8, casual: 10 };
const DENY = { error: 'You are not allowed to access this information.' };

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isStaff = (u) => u.role === 'hr' || u.role === 'admin';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- LLM call (key sirf server par, 15s timeout) ----------
async function callLLM(body) {
  if (!process.env.AI_API_KEY) throw new Error('AI is not configured');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, ...body }),
    });
    if (!r.ok) throw new Error(`AI provider error ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Tools (har tool user ke role ke hisaab se data deta hai) ----------
const impl = {
  async get_headcount(u, a) {
    if (!isStaff(u)) return DENY;
    const filter = { status: ACTIVE };
    if (a.department) filter.department = new RegExp(`^${esc(String(a.department))}$`, 'i');
    const headcount = await Employee.countDocuments(filter);
    const byDepartment = await Employee.aggregate([
      { $match: { status: ACTIVE } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ]);
    return {
      headcount,
      department: a.department || 'all',
      byDepartment: byDepartment.map((d) => ({ department: d._id || 'none', count: d.count })),
    };
  },

  async get_attendance_summary(u, a) {
    const today = dateKey(new Date());
    if (!isStaff(u)) {
      const month = today.slice(0, 7);
      const rows = await Attendance.find({ employeeId: u.employeeId, date: { $regex: `^${month}` } });
      const c = (s) => rows.filter((r) => r.status === s).length;
      return {
        scope: 'own', month, daysRecorded: rows.length, late: c('late'), halfDay: c('half_day'),
        hours: Number(rows.reduce((s, r) => s + r.hours, 0).toFixed(1)),
      };
    }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : today;
    const rows = await Attendance.find({ date });
    const headcount = await Employee.countDocuments({ status: ACTIVE });
    const c = (s) => rows.filter((r) => r.status === s).length;
    return {
      date, headcount, checkedIn: rows.length, late: c('late'), halfDay: c('half_day'),
      notCheckedIn: Math.max(headcount - rows.length, 0),
    };
  },

  async get_late_comers(u) {
    if (!isStaff(u)) return DENY;
    const month = dateKey(new Date()).slice(0, 7);
    const rows = await Attendance.aggregate([
      { $match: { status: 'late', date: { $regex: `^${month}` } } },
      { $group: { _id: '$employeeId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'e' } },
      { $unwind: '$e' },
      { $project: { _id: 0, name: '$e.name', lateCount: '$count' } },
    ]);
    return { month, topLateComers: rows };
  },

  async get_leave_summary(u) {
    const today = dateKey(new Date());
    if (!isStaff(u)) {
      const rows = await Leave.find({ employeeId: u.employeeId }).sort({ createdAt: -1 }).limit(10);
      return {
        scope: 'own',
        leaves: rows.map((l) => ({ type: l.type, from: l.startDate, to: l.endDate, days: l.days, status: l.status })),
      };
    }
    const onLeave = await Leave.find({
      status: 'approved', startDate: { $lte: today }, endDate: { $gte: today },
    }).populate('employeeId', 'name');
    const pending = await Leave.countDocuments({ status: 'pending' });
    return {
      date: today,
      onLeaveCount: onLeave.length,
      onLeaveToday: onLeave.map((l) => ({ name: l.employeeId?.name, type: l.type })),
      pendingRequests: pending,
    };
  },

  async get_my_leave_balance(u) {
    if (!u.employeeId) return { error: 'No employee profile is linked to this account.' };
    const year = String(new Date().getFullYear());
    const balance = {};
    for (const t of Object.keys(QUOTA)) {
      const rows = await Leave.find({
        employeeId: u.employeeId, type: t, status: { $in: ['pending', 'approved'] }, startDate: { $regex: `^${year}` },
      });
      const used = rows.reduce((s, r) => s + r.days, 0);
      balance[t] = { quota: QUOTA[t], used, left: QUOTA[t] - used };
    }
    return { year, balance, unpaid: 'unlimited' };
  },

  async get_payroll_summary(u, a) {
    if (!isStaff(u)) return DENY;
    const q = /^\d{4}-\d{2}$/.test(a.month || '') ? { month: a.month } : {};
    const run = await PayrollRun.findOne(q).sort({ month: -1 });
    if (!run) return { error: 'No payroll run found.' };
    return { month: run.month, status: run.status, employees: run.items.length, totalGross: run.totalGross, totalNet: run.totalNet };
  },

  async search_employees(u, a) {
    if (!isStaff(u)) return DENY;
    const q = String(a.query || '').trim();
    if (!q) return { error: 'query is required' };
    const rx = new RegExp(esc(q), 'i');
    const rows = await Employee.find({ $or: [{ name: rx }, { code: rx }, { department: rx }, { designation: rx }] }).limit(10);
    return {
      results: rows.map((e) => ({ code: e.code, name: e.name, department: e.department, designation: e.designation, status: e.status })),
    };
  },
};

const fn = (name, description, properties = {}, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});

const ALL_TOOLS = [
  fn('get_headcount', 'Number of active employees, optionally for one department', { department: { type: 'string' } }),
  fn('get_attendance_summary', 'Attendance counts for a date (YYYY-MM-DD, default today). For employees it returns their own month', { date: { type: 'string' } }),
  fn('get_late_comers', 'Top 5 late-comers this month'),
  fn('get_leave_summary', 'Who is on leave today and pending leave requests. For employees it returns their own leave requests'),
  fn('get_my_leave_balance', 'Leave balance left for the current employee (annual, sick, casual)'),
  fn('get_payroll_summary', 'Totals of a payroll run (month YYYY-MM, default latest)', { month: { type: 'string' } }),
  fn('search_employees', 'Find employees by name, code, department or designation', { query: { type: 'string' } }, ['query']),
];

const toolDefs = (u) => {
  const allowed = isStaff(u)
    ? ['get_headcount', 'get_attendance_summary', 'get_late_comers', 'get_leave_summary', 'get_payroll_summary', 'search_employees']
    : ['get_attendance_summary', 'get_leave_summary', 'get_my_leave_balance'];
  return ALL_TOOLS.filter((t) => allowed.includes(t.function.name));
};

const POLICY = `POLICY (answer policy questions only from this):
Office starts 09:00, grace 15 minutes, so late after 09:15. Half day if worked under 5 hours. Weekend is Saturday and Sunday. One check-in per day.
Leave counts working days only (no weekends or holidays). Yearly quotas: annual 14, sick 8, casual 10, unpaid unlimited. Overlapping or over-balance requests are rejected.
Payroll: gross = 1.5 x basic (HRA 40%, medical 10%). Per day = gross / working days. Deduct absent days + unpaid leave + 0.5 x half days. Joiners are prorated. Tax slab on gross x 12: up to 600k none; 5% up to 1.2M; 30k + 15% up to 2.4M; 210k + 25% up to 3.6M; 510k + 35% above. HR prepares the draft, only Admin finalizes, finalized runs are locked.`;

const systemPrompt = (u) =>
  `You are the HCM Lite assistant talking to ${u.name} (role: ${u.role}).
Answer ONLY from tool results or the policy below. Never guess numbers. If the information is not available, say you do not know.
If the user asks for another employee's salary or private data, or anything their role cannot see, politely refuse.
Keep answers short and clear. Reply in the same language the user writes (English, Urdu or Roman Urdu).
${POLICY}`;

const overLimit = async (u) =>
  (await AiLog.countDocuments({ userId: u._id, createdAt: { $gte: new Date(Date.now() - 3600000) } })) >= 20;

const log = (u, kind, prompt, answer, tools, ok, started) => {
  if (!ok) console.error('AI error:', answer);
  return AiLog.create({ userId: u._id, role: u.role, kind, prompt, answer, tools, ok, ms: Date.now() - started }).catch(() => {});
};

const FRIENDLY = 'The assistant is unavailable right now. Please try again in a moment.';

// ---------- POST /api/ai/chat ----------
exports.chat = async (req, res) => {
  const started = Date.now();
  const message = String(req.body.message || '').trim().slice(0, 500);
  if (!message) return res.status(400).json({ message: 'Message is required' });
  if (await overLimit(req.user)) return res.status(429).json({ message: 'AI limit reached (20 requests per hour).' });

  const used = [];
  try {
    const messages = [{ role: 'system', content: systemPrompt(req.user) }, { role: 'user', content: message }];
    const allowed = toolDefs(req.user).map((t) => t.function.name);
    let answer = '';
    for (let i = 0; i < 4; i++) {
      const data = await callLLM({ messages, tools: toolDefs(req.user), tool_choice: 'auto', temperature: 0.2 });
      const msg = data.choices[0].message;
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        answer = msg.content || '';
        break;
      }
      messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { args = {}; }
        const name = tc.function.name;
        used.push(name);
        const result = allowed.includes(name) ? await impl[name](req.user, args) : DENY;
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }
    if (!answer) answer = 'Sorry, I could not find an answer.';
    log(req.user, 'chat', message, answer, used, true, started);
    res.json({ answer });
  } catch (err) {
    log(req.user, 'chat', message, err.message, used, false, started);
    res.status(502).json({ message: FRIENDLY });
  }
};

// ---------- POST /api/ai/smart-leave ----------
exports.smartLeave = async (req, res) => {
  const started = Date.now();
  const text = String(req.body.text || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ message: 'Please type your leave request' });
  if (await overLimit(req.user)) return res.status(429).json({ message: 'AI limit reached (20 requests per hour).' });

  const days = [];
  for (let i = 0; i < 21; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(`${dateKey(d)} ${d.toLocaleDateString('en-US', { weekday: 'long' })}`);
  }
  const system = `Convert the employee's leave request into JSON only, no other text:
{"type":"annual|sick|casual|unpaid","start":"YYYY-MM-DD","end":"YYYY-MM-DD","reason":"short reason"}
Calendar from today (use these dates exactly, "next Monday" means the first Monday after today):
${days.join('\n')}
Wedding, family event or personal work means casual. Illness means sick. Vacation means annual. If unsure use casual.`;

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const data = await callLLM({
        messages: [{ role: 'system', content: system }, { role: 'user', content: text }],
        response_format: { type: 'json_object' },
        temperature: 0,
      });
      let j;
      try { j = JSON.parse(data.choices[0].message.content); } catch { continue; }
      const ok =
        ['annual', 'sick', 'casual', 'unpaid'].includes(j.type) &&
        /^\d{4}-\d{2}-\d{2}$/.test(j.start || '') &&
        /^\d{4}-\d{2}-\d{2}$/.test(j.end || '') &&
        j.end >= j.start;
      if (ok) {
        const out = { type: j.type, start: j.start, end: j.end, reason: String(j.reason || '').slice(0, 200) };
        log(req.user, 'smart-leave', text, JSON.stringify(out), [], true, started);
        return res.json(out);
      }
    }
    log(req.user, 'smart-leave', text, 'invalid json', [], false, started);
    res.status(422).json({ message: 'Could not understand the request. Please fill the leave form manually.' });
  } catch (err) {
    log(req.user, 'smart-leave', text, err.message, [], false, started);
    res.status(502).json({ message: FRIENDLY });
  }
};

// ---------- POST /api/ai/summary ----------
exports.summary = async (req, res) => {
  const started = Date.now();
  const kpi = req.body.kpi;
  if (!kpi || typeof kpi !== 'object') return res.status(400).json({ message: 'KPI data is required' });
  if (await overLimit(req.user)) return res.status(429).json({ message: 'AI limit reached (20 requests per hour).' });

  const json = JSON.stringify(kpi).slice(0, 3000);
  try {
    const data = await callLLM({
      messages: [
        {
          role: 'system',
          content: 'You write 3 to 5 short bullet insights for an HR dashboard. Use ONLY the numbers in the JSON given. Never invent numbers. If everything is zero or empty, say there is not enough data yet. Start each bullet with "- ".',
        },
        { role: 'user', content: json },
      ],
      temperature: 0.2,
    });
    const answer = data.choices[0].message.content || '';
    log(req.user, 'summary', json, answer, [], true, started);
    res.json({ answer });
  } catch (err) {
    log(req.user, 'summary', json, err.message, [], false, started);
    res.status(502).json({ message: FRIENDLY });
  }
};