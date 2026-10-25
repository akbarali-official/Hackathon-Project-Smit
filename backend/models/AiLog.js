const mongoose = require('mongoose');

const aiLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: String,
    kind: String, // chat | smart-leave | summary
    prompt: String,
    answer: String,
    tools: [String],
    ok: Boolean,
    ms: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('AiLog', aiLogSchema);