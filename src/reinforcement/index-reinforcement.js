require('dotenv').config();
const debugReinforcement = require('debug')('reinforcement');

const _ = require('lodash');

const MusicAIReinforcement = require('./ai-reinforcement');
const musicAIReinforcement = new MusicAIReinforcement();
const maxHelper = require('../helper/max.helper');
const express = require("express");
const bodyParser = require('body-parser');

const PORT = process.env.PORT || 3100;
let round;
let previousFailure;

/**
 * routes
 * @param app
 */
const routes = (app) => {
    app.post('/spectrogram', function (req, res) {
        if (req.body.spectrogram) {
            runCycle(req.body.spectrogram).then( () => {

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

    console.log('currentSpectro');
    console.table(currentSpectro[0]);

    // Give the reward for the previous round
    if (round > 0) {
        const difference = getDifference(currentSpectro);
        debugReinforcement("difference", difference);
        if (difference > 0) {
            debugReinforcement("PENALTY");
            musicAIReinforcement.penality(-1);
        } else if (difference < 0) {
            debugReinforcement("REWARD");
            musicAIReinforcement.reward(1);
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
        } else if (action === 1) {
            debugReinforcement('+');
            adjustKnob1 = 1; // up
        } else if (action === 2) {
            debugReinforcement('-');
            adjustKnob1 = -1; // down
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
