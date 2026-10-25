const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    code: String,
    name: String,
    department: String,
    basic: Number,
    gross: Number,
    workingDays: Number,
    payableDays: Number,
    absentDays: Number,
    unpaidDays: Number,
    halfDays: Number,
    grossPayable: Number,
    deductions: Number,
    tax: Number,
    net: Number,
  },
  { _id: false }
);

const runSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true }, // YYYY-MM
    status: { type: String, enum: ['draft', 'finalized'], default: 'draft' },
    items: [itemSchema],
    totalGross: { type: Number, default: 0 },
    totalNet: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalizedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PayrollRun', runSchema);