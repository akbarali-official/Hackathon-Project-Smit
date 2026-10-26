const bcrypt = require('bcryptjs');
const User = require('../models/User');
const audit = require('../middleware/audit');

exports.createHR = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const hr = await User.create({
      name,
      email,
      passwordHash,
      role: 'hr',
      mustChangePassword: true,
    });
    audit(req, 'create', 'user(hr)', hr._id, null, { name: hr.name, email: hr.email });
    res.status(201).json({ id: hr._id, name: hr.name, email: hr.email, role: hr.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};