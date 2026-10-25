const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const User = require('../models/User');

exports.create = async (req, res) => {
  try {
    const { code, name, email, phone, address, department, designation, joiningDate, basicSalary } = req.body;
    if (!code || !name || !email || !basicSalary) {
      return res.status(400).json({ message: 'Code, name, email and salary are required' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email' });
    }
    if (Number(basicSalary) <= 0) {
      return res.status(400).json({ message: 'Salary must be greater than 0' });
    }
    if (await Employee.findOne({ code })) {
      return res.status(409).json({ message: 'Employee code already exists' });
    }
    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const employee = await Employee.create({
      code, name, email, phone, address, department, designation,
      joiningDate: joiningDate || undefined,
      basicSalary: Number(basicSalary),
    });

    const tempPassword = crypto.randomBytes(4).toString('hex');
    try {
      const user = await User.create({
        name,
        email,
        passwordHash: await bcrypt.hash(tempPassword, 10),
        role: 'employee',
        mustChangePassword: true,
        employeeId: employee._id,
      });
      employee.userId = user._id;
      await employee.save();
    } catch (err) {
      await Employee.findByIdAndDelete(employee._id);
      throw err;
    }

    res.status(201).json({ employee, tempPassword });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const { q, department, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      filter.$or = [{ name: rx }, { email: rx }, { code: rx }];
    }
    const p = Math.max(Number(page), 1);
    const l = Math.min(Math.max(Number(limit), 1), 100);
    const [items, total] = await Promise.all([
      Employee.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
      Employee.countDocuments(filter),
    ]);
    res.json({ items, total, page: p });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};