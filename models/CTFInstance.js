var mongoose = require('mongoose')
  , Schema = mongoose.Schema

module.exports = {
    _id: Number,
    model: { type: Schema.Types.ObjectId, ref: 'CTF' },
    scores: [{ type: Schema.Types.ObjectId, ref: 'Score' }],
    challenges: [{ type: Schema.Types.ObjectId, ref: 'ChallengeInstance' }],
    closedAt: { type: Date, default: null },
    startedAt: { type: Date, default: Date.now },
    activeChallenge: { type: Number, default: 0 }
};