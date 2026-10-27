const Settings = require('../models/Settings');
const Department = require('../models/Department');
const Holiday = require('../models/Holiday');
const audit = require('../middleware/audit');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z'));
const geo = (v, min, max) => {
  if (v === '' || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const pick = (o) => ({
  companyName: o.companyName, officeStart: o.officeStart, graceMinutes: o.graceMinutes,
  halfDayHours: o.halfDayHours, weekend: o.weekend, officeLat: o.officeLat,
  officeLng: o.officeLng, officeRadius: o.officeRadius,
});

exports.getSettings = async (req, res) => {
  try {
    res.json((await Settings.findOne()) || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const s = await Settings.findOne();
    if (!s) return res.status(404).json({ message: 'Company settings not found' });
    const b = req.body;
    const before = pick(s);
    const bad = (message) => res.status(400).json({ message });

    if (b.companyName !== undefined) {
      const name = String(b.companyName).trim();
      if (!name) return bad('Company name is required');
      s.companyName = name;
    }
    if (b.officeStart !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.officeStart))) return bad('Office start must be HH:MM (24-hour)');
      s.officeStart = b.officeStart;
    }
    if (b.graceMinutes !== undefined) {
      const n = Number(b.graceMinutes);
      if (!Number.isFinite(n) || n < 0 || n > 120) return bad('Grace time must be between 0 and 120 minutes');
      s.graceMinutes = n;
    }
    if (b.halfDayHours !== undefined) {
      const n = Number(b.halfDayHours);
      if (!Number.isFinite(n) || n < 1 || n > 12) return bad('Half-day hours must be between 1 and 12');
      s.halfDayHours = n;
    }
    if (b.weekend !== undefined) {
      if (!Array.isArray(b.weekend) || !b.weekend.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
        return bad('Weekend days are invalid');
      }
      s.weekend = b.weekend;
    }
    if (b.officeRadius !== undefined) {
      const n = Number(b.officeRadius);
      if (!Number.isFinite(n) || n <= 0 || n > 5000) return bad('Radius must be between 1 and 5000 metres');
      s.officeRadius = n;
    }
    if (b.officeLat !== undefined) {
      const v = geo(b.officeLat, -90, 90);
      if (v === undefined) return bad('Latitude must be between -90 and 90');
      s.officeLat = v;
    }
    if (b.officeLng !== undefined) {
      const v = geo(b.officeLng, -180, 180);
      if (v === undefined) return bad('Longitude must be between -180 and 180');
      s.officeLng = v;
    }

    await s.save();
    audit(req, 'update', 'settings', s._id, before, pick(s));
    res.json(s);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.listDepartments = async (req, res) => {
  try {
    res.json(await Department.find().sort({ name: 1 }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addDepartment = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Department name is required' });
    if (await Department.findOne({ name: new RegExp(`^${esc(name)}$`, 'i') })) {
      return res.status(409).json({ message: 'Department already exists' });
    }
    const d = await Department.create({ name });
    audit(req, 'create', 'department', d._id, null, { name });
    res.status(201).json(d);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.removeDepartment = async (req, res) => {
  try {
    const d = await Department.findByIdAndDelete(req.params.id);
    if (!d) return res.status(404).json({ message: 'Department not found' });
    audit(req, 'delete', 'department', d._id, { name: d.name }, null);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.listHolidays = async (req, res) => {
  try {
    res.json(await Holiday.find().sort({ date: 1 }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addHoliday = async (req, res) => {
  try {
    const date = String(req.body.date || '');
    const name = String(req.body.name || '').trim();
    if (!isDate(date)) return res.status(400).json({ message: 'Date must be in YYYY-MM-DD format' });
    if (!name) return res.status(400).json({ message: 'Holiday name is required' });
    if (await Holiday.findOne({ date })) return res.status(409).json({ message: 'A holiday already exists on this date' });
    const h = await Holiday.create({ date, name });
    audit(req, 'create', 'holiday', h._id, null, { date, name });
    res.status(201).json(h);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.removeHoliday = async (req, res) => {
  try {
    const h = await Holiday.findByIdAndDelete(req.params.id);
    if (!h) return res.status(404).json({ message: 'Holiday not found' });
    audit(req, 'delete', 'holiday', h._id, { date: h.date, name: h.name }, null);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};