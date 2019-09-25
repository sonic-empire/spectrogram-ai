require('dotenv').config();
const debugPredict = require('debug')('predict');

const MusicAICNN = require('./ai-cnn');
const chokidar = require('chokidar');
const fs = require('fs');
const options = {};
const ai = new MusicAICNN(options);
const async = require('async');
const request = require('request');

const MAX4N_HOST = process.env.MAX4N_HOST || 'http://localhost:3200';

const PREDICT_FOLDER = process.env.PREDICT_FOLDER || './predict-in';
fs.mkdir(PREDICT_FOLDER, {recursive: true}, (err) => {
    if (err) throw err;
});

/**
 * Sends a knob value to m4N
 * @param prediction
 * @return {*}
 */
const controlMaxForLive = (prediction, callback) => {
    let value;
    if (prediction[0] === 1) {
        // sample is minus => knob needs to turn +
        console.log('is minus');
        value = 1;
    } else if (prediction[1] === 1) {
        // sample is plus => knob needs to turn -1
        console.log('is plus');
        value = -1;
    } else {
        console.log('is equal');
    }

    if (value) {
        request.post(`${MAX4N_HOST}/knob1`).json({value}).on('response', (res) => {
            let responseData = "";
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                // TODO: handle
                console.log("GOT RESP")
                return callback(null);
            });
            res.on('err', () => {
                console.error("Bad connection")
                return callback("Bad connection");
            });
        });
    } else {
        return callback(null);
    }
};

/**
 * Watch the predict folder for new files
 */
const watchPredictFolder = () => {
    // TODO: notifiy ableton that AI is ready
    chokidar.watch(PREDICT_FOLDER).on('all', (event, filePath) => {
        debugPredict('chokidar', event, filePath);
        if (event === 'add' && filePath.match(/.*\.json/)) {
            fs.readFile(filePath, 'utf-8', (err, file) => {
                if (err) {
                    console.error(err);
                } else {
                    const testFeature = JSON.parse(file);
                    // fs.unlink(filePath, console.log);
                    debugPredict('Got testFeature');
                    ai.predict(testFeature, (err, prediciton) => {
                        if (err) {
                            console.error(err);
                        } else {
                            debugPredict('prediciton for', filePath, prediciton);
                            controlMaxForLive(prediciton, (err) => {
                                if (err) {
                                    console.error(err)
                                }
                                fs.unlink(filePath, (err) => {
                                    if (err) { console.error(err);}
                                });
                            });
                        }
                    });
                }
            });
        }


    });
};

async.series([
    (next) => ai.loadTrainingData(next), // TODO: mv into next step
    (next) => {
        if (process.env.LOAD_MODEL === 'true') {
            ai.loadModel(next)
        } else {
            ai.buildFitSaveModel(next)
        }
    },
], (err) => {
    if (err) {
        throw new Error(err)
    } else {
        watchPredictFolder();
    }
});
