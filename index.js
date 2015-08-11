var mongoose = require('mongoose');
var winston = require('winston');
var _ = require('lodash');

var util = require('util');
var path = require('path');

var Bot = require(path.join(__dirname, 'bot'));
var models = require(path.join(__dirname, 'models'));

// config
var config = null;
try {
    config = require(path.join(__dirname, 'config.js'))
}
catch (e) {
    console.error('config.js not found');
    console.error('copy config.js.dist and to make the appropriate changes before continuing');
    process.exit(1);
}

// init logger
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({ level: 'info', colorize: true }),
        new (winston.transports.File)({ filename: 'bot.log', level: 'error' })
    ]
});

global.logger = logger;

// init mongodb
mongoose.connect(config.mongo);

// expose models as globals
models.names.forEach(function(name) {
    global[name] = models[name];
});

// init bot
var bot = new Bot(config.token);