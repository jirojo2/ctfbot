var mongoose = require('mongoose')
  , Schema = mongoose.Schema

module.exports = {
    model: { type: Schema.Types.ObjectId, ref: 'Challenge' },
    startedAt: { type: Date },
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: Number, ref: 'User' },
    resolvedAt: { type: Date }
};