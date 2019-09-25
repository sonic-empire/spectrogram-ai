require('dotenv').config();
const debugPredict = require('debug')('predict');

const MusicAICNN = require('./ai-cnn');
const fs = require('fs');
const options = {};
const ai = new MusicAICNN(options);
const async = require('async');

const maxHelper = require('../helper/max.helper');
const fileHelper = require('../helper/file.helper');

/**
 * Watch the predict folder for new files
 */
const watchPredictFolder = () => {
    fileHelper.watchFolder((err, testFeature) => {
        if (err) {
            console.log(err)
        } else {
            ai.predict(testFeature, (err, prediciton, filePath) => {
                if (err) {
                    console.error(err);
                } else {
                    debugPredict('prediciton for', filePath, prediciton);
                    maxHelper.controlMaxForLive(prediciton, (err) => {
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
    })
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
