require('dotenv').config();
const MusicAI = require('./ai');

const options = {};
const ai = new MusicAI(options);
const async = require('async');

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
        console.log('done')
    }
});
