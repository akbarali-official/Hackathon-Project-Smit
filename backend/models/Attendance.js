const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, default: null },
    hours: { type: Number, default: 0 },
    status: { type: String, enum: ['present', 'late', 'half_day', 'missing_checkout'], default: 'present' },
  },
  { timestamps: true }
);

// ek employee, ek din, ek hi record
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);