const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    officeStart: { type: String, default: '09:00' },
    graceMinutes: { type: Number, default: 15 },
    halfDayHours: { type: Number, default: 5 },
    weekend: { type: [Number], default: [0, 6] },
    officeLat: { type: Number, default: null },
    officeLng: { type: Number, default: null },
    officeRadius: { type: Number, default: 150 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);