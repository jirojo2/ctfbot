var mongoose = require('mongoose');
var path = require('path');

var schemas = {};
var models = {};

var names = [
    'CTF',
    'CTFInstance',
    'Challenge',
    'ChallengeInstance',
    'Score',
    'User'
];

names.forEach(function(name) {
    schemas[name] = new mongoose.Schema(require(path.join(__dirname, name)));
    models[name] = mongoose.model(name, schemas[name]);
    module.exports[name] = models[name];
});

module.exports.names = names;
module.exports.models = models;
module.exports.schemas = schemas;