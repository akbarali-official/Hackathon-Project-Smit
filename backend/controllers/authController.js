const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Settings = require('../models/Settings');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

const userPayload = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  mustChangePassword: u.mustChangePassword,
});

exports.status = async (req, res) => {
  const count = await User.countDocuments();
  res.json({ setupDone: count > 0 });
};

exports.setup = async (req, res) => {
  try {
    if ((await User.countDocuments()) > 0) {
      return res.status(409).json({ message: 'Setup already completed' });
    }
    const { companyName, name, email, password } = req.body;
    if (!companyName || !name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    await Settings.create({ companyName });
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await User.create({ name, email, passwordHash, role: 'admin' });
    res.status(201).json({ token: signToken(admin), user: userPayload(admin) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user: userPayload(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.me = (req, res) => {
  res.json({ user: userPayload(req.user) });
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(req.user._id);
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ message: 'Current password is wrong' });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();
    res.json({ message: 'Password changed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};