const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    department: { type: String, default: '' },
    designation: { type: String, default: '' },
    joiningDate: { type: Date, default: Date.now },
    basicSalary: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['active', 'probation', 'inactive'], default: 'active' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', employeeSchema);