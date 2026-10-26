const Leave = require('../models/leave');
const Settings = require('../models/Settings');
const audit = require('../middleware/audit');

const QUOTA = { annual: 14, sick: 8, casual: 10, unpaid: Infinity };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z'));

const countWorkingDays = (start, end, weekend) => {
  let count = 0;
  const d = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (d <= last) {
    if (!weekend.includes(d.getUTCDay())) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
};

const usedDays = async (employeeId, type, year) => {
  const rows = await Leave.find({
    employeeId,
    type,
    status: { $in: ['pending', 'approved'] },
    startDate: { $regex: `^${year}` },
  });
  return rows.reduce((sum, r) => sum + r.days, 0);
};

const balanceFor = async (employeeId, year) => {
  const out = {};
  for (const type of Object.keys(QUOTA)) {
    const used = await usedDays(employeeId, type, year);
    out[type] = {
      quota: QUOTA[type] === Infinity ? 'unlimited' : QUOTA[type],
      used,
      left: QUOTA[type] === Infinity ? 'unlimited' : QUOTA[type] - used,
    };
  }
  return out;
};

exports.apply = async (req, res) => {
  try {
    const { type, startDate, endDate, reason } = req.body;
    if (!QUOTA[type]) return res.status(400).json({ message: 'Invalid leave type' });
    if (!isDate(startDate) || !isDate(endDate)) {
      return res.status(400).json({ message: 'Dates must be in YYYY-MM-DD format' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ message: 'End date cannot be before start date' });
    }
    const employeeId = req.user.employeeId;
    if (!employeeId) return res.status(400).json({ message: 'No employee profile linked' });

    const settings = (await Settings.findOne()) || {};
    const days = countWorkingDays(startDate, endDate, settings.weekend || [0, 6]);
    if (days === 0) {
      return res.status(422).json({ message: 'Selected dates have no working days' });
    }

    const overlap = await Leave.findOne({
      employeeId,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });
    if (overlap) return res.status(422).json({ message: 'leave overlaps with an existing request' });

    const year = startDate.slice(0, 4);
    const used = await usedDays(employeeId, type, year);
    if (used + days > QUOTA[type]) {
      return res.status(422).json({
        message: `Not enough ${type} leave balance (left: ${QUOTA[type] - used}, requested: ${days})`,
      });
    }

    const leave = await Leave.create({ employeeId, type, startDate, endDate, days, reason });
    res.status(201).json(leave);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.myLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ employeeId: req.user.employeeId }).sort({ createdAt: -1 });
    const balance = await balanceFor(req.user.employeeId, String(new Date().getFullYear()));
    res.json({ balance, leaves });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.cancel = async (req, res) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, employeeId: req.user.employeeId });
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    if (leave.status !== 'pending') {
      return res.status(409).json({ message: 'Only pending leave can be cancelled' });
    }
    leave.status = 'cancelled';
    await leave.save();
    res.json(leave);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.inbox = async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const leaves = await Leave.find({ status })
      .populate('employeeId', 'code name department')
      .sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.decide = async (req, res) => {
  try {
    const { decision, comment } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approved or rejected' });
    }
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    if (leave.status !== 'pending') {
      return res.status(409).json({ message: 'Leave already decided' });
    }
    leave.status = decision;
    leave.comment = comment || '';
    leave.decidedBy = req.user._id;
    audit(req, decision, 'leave', leave._id, { status: 'pending' }, { status: decision, comment: leave.comment });
    await leave.save();
    res.json(leave);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};