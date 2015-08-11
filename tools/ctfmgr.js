var mongoose = require('mongoose');
var winston = require('winston');
var prompt = require('prompt');
var yargs = require('yargs');
var path = require('path');

// configure cli args
var argv = yargs
    .usage('Usage: $0 <action>')
    .command('list-ctf', 'list available ctfs')
    .command('create-ctf', 'creates a new ctf')
    .command('list-ctf-instances', 'list available ctf instances')
    .command('list-challenges', 'list available challenges')
    .command('create-challenge', 'creates a new challenge')
    .command('link', 'links a challenge to a ctf')
    .demand(1)
    .boolean('v')
    .help('h')
    .alias('h', 'help')
    .argv;

// load config
var config = null;
try {
    config = require(path.join(__dirname, '..', 'config.js'))
}
catch (e) {
    console.error('config.js not found');
    console.error('copy config.js.dist and to make the appropriate changes before continuing');
    process.exit(1);
}

// configure logger
var verbosity = ['info', 'debug'];
var logLevel = verbosity[Math.max(argv.v, verbosity.length)];

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({ level: logLevel, colorize: true })
    ]
});

// configure mongodb

// load models
var models = require(path.join(__dirname, '..', 'models'));

// expose models as globals
models.names.forEach(function(name) {
    global[name] = models[name];
});

// define actions
var actions = {

    'default': function defaultAction() {
        yargs.showHelp();
        process.exit(1);
    },

    'list-ctf': function listCtfAction() {
        CTF
            .find()
            .populate('challenges')
            .then(function(ctfs) {
                logger.info("Available ctf list:");
                logger.info("%s", JSON.stringify(ctfs, null, 4));
                process.exit(0);
            })
            .then(null, function(err) {
                logger.error(err);
                process.exit(1);
            })
    },

    'create-ctf': function createCtfAction() {
        prompt.override = argv;
        prompt.message = 'New ctf';
        prompt.start();

        prompt.get(['name', 'rules'], function(err, params) {
            var ctf = new CTF(params);
            ctf.save(function(err) {
                if (err) {
                    logger.error(err);
                    process.exit(1);
                }
                logger.info("Created CTF: %s", ctf.name);
                logger.info(JSON.stringify(ctf, null, 4));
                process.exit(0);
            });
        });
    },

    'list-ctf-instances': function listCtfAction() {
        CTFInstance
            .find()
            .populate('model')
            .then(function(ctfs) {
                return CTFInstance.populate(ctfs, [
                    {
                        path: 'scores',
                        model: Score
                    },
                    {
                        path: 'model.challenges',
                        model: Challenge
                    },
                    {
                        path: 'challenges',
                        model: ChallengeInstance
                    }
                ]);
            })
            .then(function(ctfs) {
                return CTFInstance.populate(ctfs, [
                    {
                        path: 'scores.user',
                        model: User
                    },
                    {
                        path: 'challenges.model',
                        model: Challenge
                    },
                    {
                        path: 'model.challenges.model',
                        model: Challenge
                    },
                    {
                        path: 'model.challenges.resolvedBy',
                        model: User
                    }
                ]);
            })
            .then(function(ctfs) {
                logger.info("Available ctf instances list:");
                logger.info("%s", JSON.stringify(ctfs, null, 4));
                process.exit(0);
            })
            .then(null, function(err) {
                logger.error(err);
                process.exit(1);
            })
    },

    'list-challenges': function listChallengesAction() {
        Challenge
            .find()
            .then(function(challenges) {
                logger.info("Available challenges list:");
                logger.info("%s", JSON.stringify(challenges, null, 4));
                process.exit(0);
            })
            .then(null, function(err) {
                logger.error(err);
                process.exit(1);
            });
    },

    'create-challenge': function createChallengeAction() {
        prompt.override = argv;
        prompt.message = 'New challenge';
        prompt.start();

        prompt.get(['name', 'desc', 'flag'], function(err, params) {
            var challenge = new Challenge(params);
            challenge.save(function(err) {
                if (err) {
                    logger.error(err);
                    process.exit(1);
                }
                logger.info("Created challenge: %s", challenge.name);
                logger.info(JSON.stringify(challenge, null, 4));
                process.exit(0);
            });
        });
    },

    'link': function linkAction() {
        prompt.override = argv;
        prompt.message = 'Link challenge to CTF';
        prompt.start();

        var ctf = null;

        prompt.get(['challenge', 'ctf'], function(err, params) {
            CTF
                .findById(params.ctf)
                .populate('challenges')
                .then(function(_ctf) {
                    ctf = _ctf;
                    return Challenge.findById(params.challenge);

                })
                .then(function(challenge) {
                    ctf.challenges.push(challenge);
                    return ctf.save();
                })
                .then(function(ctf) {
                    logger.info("Successfully linked the challenge to the ctf");
                    logger.info(JSON.stringify(ctf, null, 4));
                    process.exit(0);
                })
                .then(null, function(err) {
                    if (err) {
                        logger.error(err);
                        process.exit(1);
                    }
                })
        })
    }
}

// connect to database
mongoose.connect(config.mongo, function(err) {

    if (err) {
        return logger.error(err);
    }

    // call the action
    var action = argv._[0];
    if (!(actions[action] instanceof Function)) {
        action = 'default';
    }
    actions[action]();
});

// graceful exist
function gracefulExit() {
    // close any db connections
    mongoose.disconnect();
    process.exit(0);
}

// If the Node process ends, close the Mongoose connection
process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);