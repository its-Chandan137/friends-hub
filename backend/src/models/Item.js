const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  section: { type: String, required: true, enum: ['meals', 'events', 'fitness'] },
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // flexible JSON for meal details
  status: {
    type: String,
    enum: ['New', 'Updating', 'Updated'],
    default: 'New',
  },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lockedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

module.exports = mongoose.model('Item', itemSchema);