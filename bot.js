var telegram = require('telegram-bot-api');
var util = require('util');
var _ = require('lodash');

// helper callback
function defaultApiCallback(err) {
    if (err) {
        logger.error("Error on API Callback: %j", err);
    }
}

// bot object
function Bot(token) {

    this.id = null;
    this.name = null;
    this.username = null;

    var self = this;

    var api = this.api = new telegram({
        token: token,
        updates: {
            enabled: true,
            get_interval: 1000
        }
    });

    // define command handlers here
    var commands = {

        /**
         * Command: Help
         * Prints help usage and available commands
         */
        help: function HelpCommandHandler(msg, args, ctf) {
            var ctfName = ctf ? ctf.name : 'CTF Bot';
            t = [
                "/help",
                "/start",
                "/rules",
                "/scores",
                "/challenge",
                "/flag <flag>"
            ].join('\n')
            api.sendMessage({
                chat_id: msg.chat.id,
                text: util.format("%s - Help\n\n%s",
                                    ctfName,
                                    t)
            }, defaultApiCallback);
        },

        /**
         * Command: Start
         * Params:
         *   String ctfName - identifies the ctf model
         * Instantiates a ctf in the current chat
         */
        start: function StartCommandHandler(msg, args, ctf) {
            if (ctf) {
                // a ctf already exists... what to do?
                logger.warn("A CTF already exists for chat %s", msg.chat.title || msg.chat.first_name);
            }

            if (!args.length) {
                // ctf name is required
                return api.sendMessage({
                    chat_id: msg.chat.id,
                    reply_to_message_id: msg.message_id,
                    text: "CTF Bot - Start CTF Usage\n\n/start <CTF Name>"
                }, defaultApiCallback);
            }

            var ctfName = args.join(' ');

            CTF
                .findOne({ name: ctfName })
                .then(function(ctfModel) {

                    if (!ctfModel) {
                        return api.sendMessage({
                            chat_id: msg.chat.id,
                            reply_to_message_id: msg.message_id,
                            text: util.format("CTF \"%s\" is not valid", ctfName)
                        }, defaultApiCallback);
                    }

                    var ctf = new CTFInstance({
                        _id: msg.chat.id,
                        model: ctfModel._id
                    });

                    return ctf.save();
                })
                .then(function(ctf) {
                    return CTFInstance.populate(ctf, {
                        path: 'model',
                        model: CTF
                    });
                })
                .then(function(ctf) {
                    return CTFInstance.populate(ctf, {
                        path: 'model.challenges',
                        model: Challenge
                    });
                })
                .then(function(ctf) {
                    for (var i = 0; i < ctf.model.challenges.length; i++) {
                        var challengeInstance = new ChallengeInstance({
                            model: ctf.model.challenges[i]._id
                        });
                        ctf.challenges.push(challengeInstance);
                        challengeInstance.save();
                    }
                    return ctf.save();
                })
                .then(function(_ctf) {
                    ctf = _ctf;
                    ctf.model.instances.push(ctf);
                    return ctf.model.save();
                })
                .then(function(ctfModel) {
                    return api.sendMessage({
                        chat_id: msg.chat.id,
                        text: util.format("CTF \"%s\" Started!\n\nRules:\n------------------\n%s",
                                            ctfModel.name,
                                            ctfModel.rules)
                    }, function(err) {
                        if (err) throw err;
                        return commands.challenge(msg, [], ctf);
                    });
                })
                .then(null, function(err) {
                    logger.error(err);
                });
        },

        /**
         * Command: Scores
         * Shows the scores for this CTF
         */
        scores: function(msg, args, ctf) {

            if (!ctf) {
                return api.sendMessage({
                    chat_id: msg.chat.id,
                    reply_to_message_id: msg.message_id,
                    text: "There is no running CTF"
                }, defaultApiCallback);
            }

            CTFInstance
                .populate(ctf, {
                    path: 'scores',
                    model: Score
                })
                .then(function(ctf) {
                    return CTFInstance.populate(ctf, {
                        path: 'scores.user',
                        model: User
                    });
                })
                .then(function(ctf) {
                    // TODO: sort scores desc
                    // TODO: display scores
                    var sortedScores = _.sortBy(ctf.scores, 'score');
                    sortedScores.reverse();

                    var t = sortedScores.map(function(x) {
                        return util.format("@%s: %d", x.user.username, x.score);
                    }).join("\n");

                    return api.sendMessage({
                        chat_id: msg.chat.id,
                        text: util.format("CTF \"%s\" Scores\n\n%s", ctf.model.name, t)
                    }, defaultApiCallback);
                })
                .then(null, function(err) {
                    logger.error(err);
                })
        },


        /**
         * Command: Rules
         * Shows the rules for this CTF
         */
        rules: function(msg, args, ctf) {

            if (!ctf) {
                return api.sendMessage({
                    chat_id: msg.chat.id,
                    reply_to_message_id: msg.message_id,
                    text: "There is no running CTF"
                }, defaultApiCallback);
            }

            return api.sendMessage({
                chat_id: msg.chat.id,
                reply_to_message_id: msg.message_id,
                text: util.format("CTF \"%s\" Rules:\n\n%s",
                                    ctf.model.name,
                                    ctf.model.rules)
            }, defaultApiCallback);
        },

        /**
         * Command: Challenge
         * Params:
         *   Integer challengeIdx - index of the challenge
         * Shows the details about the current or specified challenge
         */
        challenge: function(msg, args, ctf) {

            if (!ctf) {
                return api.sendMessage({
                    chat_id: msg.chat.id,
                    reply_to_message_id: msg.message_id,
                    text: "There is no running CTF"
                }, defaultApiCallback);
            }

            CTFInstance
                .populate(ctf, [
                    {
                        path: 'model.challenges',
                        model: Challenge
                    },
                    {
                        path: 'challenges',
                        model: ChallengeInstance
                    }
                ])
                .then(function(ctf) {
                    return CTFInstance.populate(ctf, {
                        path: 'challenges.model',
                        model: Challenge
                    });
                })
                .then(function(ctf) {

                    var challenge = null;
                    var challengeIdx = ctf.activeChallenge;

                    if (ctf.closedAt) {
                        return api.sendMessage({
                            chat_id: msg.chat.id,
                            reply_to_message_id: msg.message_id,
                            text: "The CTF is not active!"
                        }, defaultApiCallback);
                    }

                    if (args.length && !isNaN(args[0]))
                        challengeIdx = Number(args[0]);

                    if (challengeIdx >= ctf.challenges.length) {
                        return api.sendMessage({
                            chat_id: msg.chat.id,
                            reply_to_message_id: msg.message_id,
                            text: "Invalid challenge!"
                        }, defaultApiCallback);
                    }

                    challenge = ctf.challenges[challengeIdx];
                    return api.sendMessage({
                        chat_id: msg.chat.id,
                        text: util.format("Challenge %d: %s\n\n%s",
                                            challengeIdx,
                                            challenge.model.name,
                                            challenge.model.desc)
                    }, defaultApiCallback);
                })
                .then(null, function(err) {
                    logger.error(err);
                });
        },

        /**
         * Command: Flag
         * Params:
         *   String flag - flag that validates the challenge
         * Validates the flag and, if correct, scores for the sender user
         */
        flag: function(msg, args, ctf) {

            if (!args || args.length < 1) {
                return api.sendMessage({
                    chat_id: msg.chat.id,
                    reply_to_message_id: msg.message_id,
                    text: 'usage:\n\n/flag <flag>'
                }, defaultApiCallback);
            }

            var flag = args[0];

            if (!ctf) {
                return api.sendMessage({
                    chat_id: msg.chat.id,
                    reply_to_message_id: msg.message_id,
                    text: "There is no running CTF"
                }, defaultApiCallback);
            }

            CTFInstance
                .populate(ctf, [
                    {
                        path: 'model.challenges',
                        model: Challenge
                    },
                    {
                        path: 'challenges',
                        model: ChallengeInstance
                    },
                    {
                        path: 'scores',
                        model: Score
                    }
                ])
                .then(function(ctg) {
                    return CTFInstance.populate(ctf, [
                        {
                            path: 'challenges.model',
                            model: Challenge
                        },
                        {
                            path: 'scores.user',
                            model: User
                        }
                    ]);
                })
                .then(function(ctf) {
                    var challenge = ctf.challenges[ctf.activeChallenge];

                    if (ctf.closedAt) {
                        logger.warn('Flag submitted to already closed ctf!');

                        return api.sendMessage({
                            chat_id: msg.chat.id,
                            reply_to_message_id: msg.message_id,
                            text: "The CTF is closed!"
                        }, defaultApiCallback);
                    }

                    if (challenge.resolved) {
                        logger.warn('Flag submitted for already resolved challenge!');

                        return api.sendMessage({
                            chat_id: msg.chat.id,
                            reply_to_message_id: msg.message_id,
                            text: "nope (not first to resolve this challenge)"
                        }, defaultApiCallback);
                    }

                    if (challenge.model.flag === flag) {
                        // flag validated
                        var newScore = false;

                        // mark challenge as resolved
                        challenge.resolved = true;
                        challenge.resolvedBy = msg.from.id;
                        challenge.resolvedAt = new Date();

                        challenge
                            .save()
                            .then(function(challenge) {

                                // update scores
                                var score = null;
                                for (var i = ctf.scores.length - 1; i >= 0; i--) {
                                    var s = ctf.scores[i];
                                    if (s.user._id === msg.from.id) {
                                        score = s;
                                        break;
                                    }
                                }

                                if (!score) {
                                    score = new Score({
                                        user: msg.from.id,
                                        score: 1,
                                        challenges: [ challenge._id ]
                                    });

                                    newScore = true;

                                    // Create user if doesn't exists
                                    User
                                        .findById(msg.from.id)
                                        .then(function(user) {
                                            if (!user) {
                                                user = new User({
                                                    _id: msg.from.id,
                                                    username: msg.from.username,
                                                    first_name: msg.from.first_name,
                                                    last_name: msg.from.last_name
                                                });
                                                return user.save();
                                            }
                                        })
                                        .then(null, function(err) {
                                            logger.error(err);
                                        });
                                }
                                else {
                                    score.score += 1;
                                    score.challenges.push(challenge);
                                }

                                // send correct flag response
                                api.sendMessage({
                                    chat_id: msg.chat.id,
                                    reply_to_message_id: msg.message_id,
                                    text: "correct!"
                                }, defaultApiCallback);

                                return score.save();
                            })
                            .then(function(score) {

                                if (newScore) {
                                    ctf.scores.push(score);
                                }

                                if (ctf.activeChallenge+1 >= ctf.challenges.length) {
                                    // no more challenges => close the CTF
                                    ctf.closedAt = Date.now();
                                    ctf.save(function(err) {
                                        if (err) throw err;

                                        // display close msg
                                        // display winners
                                        // display final scores
                                        api.sendMessage({
                                            chat_id: msg.chat.id,
                                            reply_to_message_id: msg.message_id,
                                            text: util.format("CTF \"%s\" has ended!", ctf.model.name)
                                        }, function(err) {
                                            if (err) throw err;
                                            return commands.scores(msg, [], ctf);
                                        });
                                    });
                                }
                                else {
                                    // activate next challenge
                                    ctf.activeChallenge += 1;
                                    ctf.save(function(err) {
                                        if (err) throw err;

                                        // display next challenge
                                        commands.challenge(msg, [], ctf);
                                    });
                                }
                            })
                            .then(null, function(err) {
                                logger.error(err);
                            });
                    }
                    else {
                        return api.sendMessage({
                            chat_id: msg.chat.id,
                            reply_to_message_id: msg.message_id,
                            text: "nope"
                        }, defaultApiCallback);
                    }
                })
                .then(null, function (err) {
                    logger.error(err);
                });
        }
    }

    // init bot
    api.getMe(function(err, data)
    {
        if (err) {
            throw util.format("ERROR initializing bot: %s", err);
        }

        logger.info("Initialized bot %s [%d] @%s", data.first_name, data.id, data.username);

        api.on('message', function handleMessage(msg) {

            // handle command
            var text = msg.text || '';
            var args = text.split(' ');
            var cmd = args.splice(0, 1)[0];
            var ctf = null;

            // get ctf instance by chat id
            CTFInstance
                .findOne({ '_id': msg.chat.id })
                .populate('model')
                .then(function(ctf) {
                    if (cmd.indexOf('/') === 0 && cmd.substr(1) in commands) {
                        commands[cmd.substr(1)](msg, args, ctf);
                    }
                })
                .then(null, function(err) {
                    logger.error("Error handling message from @%s at %s: %j",
                        msg.from.username,
                        msg.chat.title || msg.chat.first_name,
                        err);
                })
        });
    });
}

module.exports = Bot;