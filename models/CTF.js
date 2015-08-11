var mongoose = require('mongoose')
  , Schema = mongoose.Schema

module.exports = {
    name: { type: String, index: { unique: true }, required: true },
    rules: { type: String, required: true },
    instances: [{ type: Number, ref: 'CTFInstance' }],
    challenges: [{ type: Schema.Types.ObjectId, ref: 'Challenge' }]
};