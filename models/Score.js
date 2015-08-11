var mongoose = require('mongoose')
  , Schema = mongoose.Schema

module.exports = {
    score: Number,
    user: { type: Number, ref: 'User' },
    challenges: [{ type: Schema.Types.ObjectId, ref: 'ChallengeInstance' }]
};