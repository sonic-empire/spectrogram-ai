require('dotenv').config();
const debugReinforcement = require('debug')('reinforcement');
const debugReinforcementVerbose = require('debug')('reinforcement:verbose');


const _ = require('lodash');

const MusicAIReinforcement = require('./ai-reinforcement');
const musicAIReinforcement = new MusicAIReinforcement();
const maxHelper = require('../helper/max.helper');
const express = require("express");
const bodyParser = require('body-parser');

const PORT = process.env.PORT || 3100;
let round;
let previousFailure;
let previousCommand;

/**
 * routes
 * @param app
 */
const routes = (app) => {
    app.post('/spectrogram', function (req, res) {
        if (req.body.spectrogram) {
            runCycle(req.body.spectrogram).then(() => {

            });
        }
        res.json({success: true})
    });
};

/**
 * Open a server (default port 3100) to listen for new spectrorams
 */
const listenForSpectrograms = () => {
    round = 0;
    previousFailure = 0;
    const app = express();
    app.use(bodyParser.json({limit: '100mb'}));
    routes(app);
    app.listen(PORT);
    debugReinforcement('Listening on', PORT);
};

const control = (action) => {
    maxHelper.controlMaxForLive(action, (err) => {
        if (err) {
            console.error(err)
        }
    });
};

/**
 * Runs a reward/penalty cycle
 * @param err
 * @param currentSpectro
 * @return {Promise<void>}
 */
const runCycle = async (currentSpectro) => {
    debugReinforcement('\n\n---------------------------\nRound', round);

    if (debugReinforcementVerbose.enabled) {
        debugReinforcementVerbose('currentSpectro');
        console.table(currentSpectro[0]);
    }

    // Give the reward for the previous round
    if (round > 0) {
        const difference = getDifference(currentSpectro);
        debugReinforcement("difference", difference);
        debugReinforcement('PREV CMD', previousCommand);
        if (difference > 0) {
            const penalty = -difference;//-Math.sqrt(Math.abs(difference));
            debugReinforcement("PENALTY", penalty);
            musicAIReinforcement.penality(penalty);
        } else if (difference < 0) {
            const reward = -difference; //Math.sqrt(Math.abs(difference));
            debugReinforcement("REWARD", reward);
            musicAIReinforcement.reward(reward);
        } else {
            const reward = 10;
            debugReinforcement("REWARD", reward);
            musicAIReinforcement.reward(reward);
        }
    }

    // Get the recommended action by the AI
    // assert.equal(inputs.length, inputSize, "The Input Size dose not match the Inputs Array length");
    const input = _.flattenDeep(currentSpectro);
    const action = await musicAIReinforcement.step(input);
    debugReinforcement('ACTION', action);


    adjustKnob1 = 0;
    if (action) {
        if (action === 0) {
            debugReinforcement('=');
            // do nothing
            adjustKnob1 = 0; // to reset gate in ableton
            previousCommand = '=';
        } else if (action > 0 && action <= 8) {
            debugReinforcement('+');
            adjustKnob1 = action; // up
            previousCommand = '+';
        } else if (action > 8 && action <= 16) {
            debugReinforcement('-');
            adjustKnob1 = -(action -8); // down
            previousCommand = '-';
        } else {
            console.log('unknown action', action)
        }
    }

    // control
    control(adjustKnob1);
    round++;

};

/**
 * the incoming spectrogram is the difference between both sounds (reference, current)
 * it improves if there is less amp at each frequency
 * @param currentSpectro
 * @return {*}
 */
const getFailure = (currentSpectro) => {
    // TODO: test divide in high/mid/low
    return currentSpectro.reduce((accumulator, currentValue) => {
        return accumulator + currentValue.reduce((accumulator, currentValue) => {
            return accumulator + currentValue;
        }, 0);
    }, 0);
};

/**
 * Calculate the difference between this and the last failure
 * @param currentSpectro
 * @param lastSpectro
 */
const getDifference = (currentSpectro) => {
    const currentFailure = getFailure(currentSpectro);
    const difference = currentFailure - previousFailure;
    debugReinforcement('difference', difference, 'currentFailure', currentFailure, 'previousFailure', previousFailure);
    previousFailure = currentFailure;
    return difference;
};

listenForSpectrograms();
