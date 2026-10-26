const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    postedBy: String,
    role: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);