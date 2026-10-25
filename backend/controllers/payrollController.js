const PayrollRun = require('../models/PayrollRun');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Settings = require('../models/Settings');

const pad = (n) => String(n).padStart(2, '0');
const localKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const round = (n) => Math.round(n * 100) / 100;

const daysBetween = (a, b) => {
  const out = [];
  const d = new Date(a + 'T00:00:00Z');
  const end = new Date(b + 'T00:00:00Z');
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};
const isWorking = (s, weekend) => !weekend.includes(new Date(s + 'T00:00:00Z').getUTCDay());

const annualTax = (a) => {
  if (a <= 600000) return 0;
  if (a <= 1200000) return (a - 600000) * 0.05;
  if (a <= 2400000) return 30000 + (a - 1200000) * 0.15;
  if (a <= 3600000) return 210000 + (a - 2400000) * 0.25;
  return 510000 + (a - 3600000) * 0.35;
};

// HR: draft banao (dobara chalane par draft naye sire se ban jata hai)
exports.run = async (req, res) => {
  try {
    const { month } = req.body;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
      return res.status(400).json({ message: 'Month must be in YYYY-MM format' });
    }
    const existing = await PayrollRun.findOne({ month });
    if (existing && existing.status === 'finalized') {
      return res.status(409).json({ message: 'Payroll for this month is finalized and locked' });
    }

    const settings = (await Settings.findOne()) || {};
    const weekend = settings.weekend || [0, 6];
    const [y, m] = month.split('-').map(Number);
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
    const today = localKey(new Date());

    const monthWorkingDays = daysBetween(monthStart, monthEnd).filter((d) => isWorking(d, weekend));
    const totalWorking = monthWorkingDays.length;
    if (totalWorking === 0) return res.status(422).json({ message: 'No working days in this month' });

    const employees = await Employee.find({ status: { $in: ['active', 'probation'] } });
    const items = [];

    for (const e of employees) {
      const joined = e.joiningDate ? localKey(e.joiningDate) : monthStart;
      if (joined > monthEnd) continue;
      const start = joined > monthStart ? joined : monthStart;
      const payableList = monthWorkingDays.filter((d) => d >= start);
      const payableDays = payableList.length;
      if (payableDays === 0) continue;

      const records = await Attendance.find({
        employeeId: e._id,
        date: { $gte: monthStart, $lte: monthEnd },
      });
      const attDates = new Set(records.map((r) => r.date));
      const halfDays = records.filter((r) => r.status === 'half_day').length;

      const leaves = await Leave.find({
        employeeId: e._id,
        status: 'approved',
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart },
      });
      const leaveDay = new Map();
      for (const l of leaves) {
        const from = l.startDate > monthStart ? l.startDate : monthStart;
        const to = l.endDate < monthEnd ? l.endDate : monthEnd;
        for (const d of daysBetween(from, to)) {
          if (isWorking(d, weekend)) leaveDay.set(d, l.type);
        }
      }

      const absentDays = payableList.filter((d) => d < today && !attDates.has(d) && !leaveDay.has(d)).length;
      const unpaidDays = payableList.filter((d) => leaveDay.get(d) === 'unpaid').length;

      const basic = e.basicSalary;
      const gross = basic * 1.5; // basic + HRA 40% + medical 10%
      const perDay = gross / totalWorking;
      const grossPayable = perDay * payableDays;
      const deductions = perDay * (absentDays + unpaidDays + 0.5 * halfDays);
      const tax = (annualTax(gross * 12) / 12) * (payableDays / totalWorking);
      const net = grossPayable - deductions - tax;

      items.push({
        employeeId: e._id,
        code: e.code,
        name: e.name,
        department: e.department,
        basic,
        gross: round(gross),
        workingDays: totalWorking,
        payableDays,
        absentDays,
        unpaidDays,
        halfDays,
        grossPayable: round(grossPayable),
        deductions: round(deductions),
        tax: round(tax),
        net: round(net),
      });
    }

    const runDoc = existing || new PayrollRun({ month });
    runDoc.items = items;
    runDoc.status = 'draft';
    runDoc.totalGross = round(items.reduce((s, i) => s + i.grossPayable, 0));
    runDoc.totalNet = round(items.reduce((s, i) => s + i.net, 0));
    runDoc.createdBy = req.user._id;
    await runDoc.save();
    res.status(existing ? 200 : 201).json(runDoc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    res.json(await PayrollRun.find().select('-items').sort({ month: -1 }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const runDoc = await PayrollRun.findOne({ month: req.params.month });
    if (!runDoc) return res.status(404).json({ message: 'No payroll run for this month' });
    res.json(runDoc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: lock
exports.finalize = async (req, res) => {
  try {
    const runDoc = await PayrollRun.findOne({ month: req.params.month });
    if (!runDoc) return res.status(404).json({ message: 'No payroll run for this month' });
    if (runDoc.status === 'finalized') {
      return res.status(409).json({ message: 'Already finalized' });
    }
    runDoc.status = 'finalized';
    runDoc.finalizedBy = req.user._id;
    runDoc.finalizedAt = new Date();
    await runDoc.save();
    res.json(runDoc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Employee: sirf apni finalized payslips
exports.mySlips = async (req, res) => {
  try {
    const id = String(req.user.employeeId);
    const settings = (await Settings.findOne()) || {};
    const runs = await PayrollRun.find({ status: 'finalized', 'items.employeeId': req.user.employeeId }).sort({ month: -1 });
    const slips = runs.map((r) => {
      const mine = r.items.find((i) => String(i.employeeId) === id).toObject();
      return { ...mine, month: r.month, company: settings.companyName || '' };
    });
    res.json(slips);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};