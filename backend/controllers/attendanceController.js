const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');

const dateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

exports.checkIn = async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(400).json({ message: 'No employee profile linked to this account' });
    }
    const settings = (await Settings.findOne()) || {};
    const now = new Date();

    const [h, m] = (settings.officeStart || '09:00').split(':').map(Number);
    const lateAfter = new Date(now);
    lateAfter.setHours(h, m + (settings.graceMinutes ?? 15), 0, 0);

    const record = await Attendance.create({
      employeeId: req.user.employeeId,
      date: dateKey(now),
      checkIn: now,
      status: now > lateAfter ? 'late' : 'present',
    });
    res.status(201).json(record);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Already checked in today' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const record = await Attendance.findOne({
      employeeId: req.user.employeeId,
      date: dateKey(new Date()),
    });
    if (!record) return res.status(404).json({ message: 'You have not checked in today' });
    if (record.checkOut) return res.status(409).json({ message: 'Already checked out today' });

    const settings = (await Settings.findOne()) || {};
    record.checkOut = new Date();
    record.hours = Number(((record.checkOut - record.checkIn) / 3600000).toFixed(2));
    if (record.hours < (settings.halfDayHours ?? 5)) record.status = 'half_day';
    await record.save();
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Employee: sirf apne records
exports.myRecords = async (req, res) => {
  try {
    const records = await Attendance.find({ employeeId: req.user.employeeId })
      .sort({ date: -1 })
      .limit(60);
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// HR / Admin: kisi bhi din ka board (default aaj)
exports.board = async (req, res) => {
  try {
    const date = req.query.date || dateKey(new Date());
    const records = await Attendance.find({ date }).populate('employeeId', 'code name department');
    res.json({ date, records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};