const debugHelperFile = require('debug')('helper:file');
const chokidar = require('chokidar');
const fs = require('fs');

const PREDICT_FOLDER = process.env.PREDICT_FOLDER || './predict-in';
fs.mkdir(PREDICT_FOLDER, {recursive: true}, (err) => {
    if (err) throw err;
});

/**
 * Watch the predict folder for new files
 */
exports.watchPredictFolder = (callback) => {
    chokidar.watch(PREDICT_FOLDER).on('all', (event, filePath) => {
        debugHelperFile('chokidar', event, filePath);
        if (event === 'add' && filePath.match(/.*\.json/)) {
            fs.readFile(filePath, 'utf-8', (err, file) => {
                if (err) {
                    return callback(err);
                } else {
                    const testFeature = JSON.parse(file);
                    // fs.unlink(filePath, console.log);
                    debugHelperFile('Got testFeature');
                    callback(null, testFeature, filePath)
                }
            });
        }


    });
};
