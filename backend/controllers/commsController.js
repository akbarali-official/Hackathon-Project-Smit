const Announcement = require('../models/Announcement');
const AuditLog = require('../models/AuditLog');
const audit = require('../middleware/audit');

exports.listAnnouncements = async (req, res) => {
  try {
    res.json(await Announcement.find().sort({ createdAt: -1 }).limit(30));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.postAnnouncement = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const body = String(req.body.body || '').trim();
    if (!title || !body) return res.status(400).json({ message: 'Title and message are required' });
    const a = await Announcement.create({ title, body, postedBy: req.user.name, role: req.user.role });
    audit(req, 'create', 'announcement', a._id, null, { title });
    res.status(201).json(a);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.listAudit = async (req, res) => {
  try {
    res.json(await AuditLog.find().sort({ createdAt: -1 }).limit(100));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};