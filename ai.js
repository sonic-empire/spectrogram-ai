require('dotenv').config();
const debugAI = require('debug')('ai');
const debugAIModel = require('debug')('ai:model');
const debugAIVerbose = require('debug')('ai:verbose');
const debugAIVisualize = require('debug')('ai:visualize');

const tfNode = require('@tensorflow/tfjs-node');
const plot = require('node-remote-plot');
const fs = require('fs');
const async = require('async');
const _ = require('lodash');

const SAVE_PATH = './tf-models';
fs.mkdir(SAVE_PATH, {recursive: true}, (err) => {
    if (err) throw err;
});

tfNode.node.summaryFileWriter('./.tmp/');

class MusicAI {
    constructor(options) {
        this.features = [];
        this.labels = []; // shape [x, 2] drum, noise

        this.options = Object.assign(
            {
                learningRate: 10,
                epochs: 10,
                batchSize: 2,
                decisionBoundary: 0.5,
                verbose: 10,
                shuffle: true,
                validationSplit: 0.1,
                trainingDataFolder: process.env.DATA_IN || './data-in',
                callbacks: tfNode.node.tensorBoard('./.tmp/fit_logs_1')
            },
            options);
        debugAIModel('Creating AI with options', this.options);
    }

    loadTrainingData(callback) {
        this.features = [];
        this.labels = [];
        const trainingDataFolder = this.options.trainingDataFolder
        debugAI('loading data from', trainingDataFolder);
        fs.readdir(trainingDataFolder, (err, files) => {
            files = files.filter(fileName => fileName.match(/\.json/));
            // organize files to auto add labels
            async.series([ // TODO: change to parallel
                next => {
                    // iterate through all files and push to features/labels
                    async.eachSeries(files, (fileName, next) => {
                        const filePath = trainingDataFolder + '/' + fileName;
                        fs.readFile(filePath, 'utf-8', (err, fileContent) => {
                            if (err) return next(err);
                            const spectrographJson = JSON.parse(fileContent);
                            this.features.push(spectrographJson);
                            if (fileName.indexOf('minus') !== -1) {
                                this.labels.push([1 , 0])
                            } else if (fileName.indexOf('plus') !== -1) {
                                this.labels.push([0 , 1])
                            } else if (fileName.indexOf('reference') !== -1) {
                                this.labels.push([0 , 0])
                            } else {
                                throw new Error('Label not known')
                            }
                            return next(null);
                        })
                    }, next);
                },
                // next => { // clean the data, make all tensors the same length
                //     const minimumLength = _.min(this.features, (feature) => feature.length);
                //     debugAI('The smalles feature has the length', minimumLength);
                //     this.features = this.features.map((element, index) => {
                //         if (element.length > minimumLength) {
                //             debugAIVerbose(`Cropping feature ${index} from ${element.length} to ${minimumLength}`)
                //             return element.slice(0, minimumLength);
                //         } else {
                //             return element
                //         }
                //     });
                //     return next();
                // },
                next => { //  convert data into tensors and normalize features
                    if (debugAIVisualize.enabled === true) {
                        debugAIVisualize("ATTENTION VISUALIZE ENABLED");
                        this.features.slice(0, 32).forEach((feature, index) => {
                            debugger;
                            this.visualizeData(feature, 'noteFrequencyData' + index);
                        });
                    }
                    console.clear()
                    debugAI(`Number of samples ${this.features.length}, each sample has sequences ${this.features[0].length} each sequence has features/freq. points ${this.features[0][0].length}`)
                    // first convert to tensors
                    let featuresShape = [this.features.length, this.features[0].length, this.features[0][0].length];
                    const labelsShape = [this.labels.length, this.labels[0].length];
                    this.features = tfNode.tensor3d(this.features, featuresShape);
                    this.features = this.features.reshape([this.features.shape[0],this.features.shape[1],this.features.shape[2],1])
                    this.labels = tfNode.tensor2d(this.labels, labelsShape);

                    debugAI('features shape', this.features.shape);
                    debugAI('labels shape', this.labels.shape);

                    // normalize
                    if (this.options.normalize === true) {
                        debugAI('normalizing features', this.features.shape);
                        this.determineMeanAndStddev(this.features);
                        this.features = this.normalizeTensor(this.features);
                    }
                    return next();
                }
            ], callback);
        });
    }

    // https://github.com/tensorflow/tfjs-data/blob/master/demo/boston-housing/normalization.ts
    determineMeanAndStddev(data) {
        const dataMean = data.mean(0);
        const diffFromMean = data.sub(dataMean);
        const squaredDiffFromMean = diffFromMean.square();
        let variance = squaredDiffFromMean.mean(0);

        // avoid NaN bug
        const filler = variance.cast('bool').logicalNot().cast('float32');
        variance = variance.add(filler);

        const dataStd = variance.sqrt();
        this.dataMean = dataMean;
        this.dataStd = dataStd;
        return {dataMean, dataStd};
    }

    normalizeTensor(tensor2d) {
        if (this.dataMean == null) throw new Error("this.dataMean is missing");
        if (this.dataStd == null) throw new Error("this.dataStd is missing");
        // console.log("before norm");
        // tensor2d.print();
        const normalizedTensor = tensor2d
            .sub(this.dataMean)
            .div(this.dataStd);
        // console.log("after norm");
        // normalizedTensor.print();
        return normalizedTensor;
    }

    visualizeData(data, label) {
        debugAIVerbose(label + 'max %s, min %, mean %', _.max(data), _.min(data), _.mean(data));
        plot({
            x: data,
            xLabel: 'Time chunks',
            yLabel: 'Amplitude',
            name: '.tmp/plots/' + label
        });
        debugAIVerbose(data.map((el, index) => {
            if (el > 0) {
                return index
            } else {
                return null
            }
        }).filter(el => el).length);
    };

    buildModel() {
        const inputShape1 = [this.features.shape[1], this.features.shape[2],this.features.shape[3]];
        this.model = tfNode.sequential();
        // filter to the image => feature extractor, edge detector, sharpener (depends on the models understanding)
        this.model.add(tfNode.layers.conv2d(
            {filters: 8, kernelSize: [4, 2], activation: 'relu', inputShape: inputShape1}
        ));

        // see the image at a higher level, generalize it more, prevent overfit
        this.model.add(tfNode.layers.maxPooling2d(
            {poolSize: [2, 2], strides: [2, 2]}
        ));

        // filter to the image => feature extractor, edge detector, sharpener (depends on the models understanding)
        const inputShape2 = [119,62,8];
        this.model.add(tfNode.layers.conv2d(
            {filters: 32, kernelSize: [4, 2], activation: 'relu', inputShape: inputShape2}
        ));

        // see the image at a higher level, generalize it more, prevent overfit
        this.model.add(tfNode.layers.maxPooling2d(
            {poolSize: [2, 2], strides: [2, 2]}
        ));

        // filter to the image => feature extractor, edge detector, sharpener (depends on the models understanding)
        const inputShape3 = [58,30,32];
        this.model.add(tfNode.layers.conv2d(
            {filters: 32, kernelSize: [4, 2], activation: 'relu', inputShape: inputShape3}
        ));

        // see the image at a higher level, generalize it more, prevent overfit
        this.model.add(tfNode.layers.maxPooling2d(
            {poolSize: [2, 2], strides: [2, 2]}
        ));

        // 1D output, => final output score of labels
        this.model.add(tfNode.layers.flatten({}));

        // prevents overfitting, randomly set 0
        this.model.add(tfNode.layers.dropout({rate: 0.25}));

        // learn anything linear, non linear comb. from conv. and soft pool
        this.model.add(tfNode.layers.dense({units: 2000, activation: 'relu'}));

        this.model.add(tfNode.layers.dropout({rate: 0.25}));

        // give probability for each label
        this.model.add(tfNode.layers.dense({units: this.labels.shape[1], activation: 'softmax'}));


        // compile the model
        this.model.compile({loss: 'meanSquaredError', optimizer: 'adam'});
        this.model.summary()
    };

    saveModel() {
        this.model.save('file://' + SAVE_PATH + '/' + 'model').then((err) => {
            console.log(err)
        })
    }

    loadModel(callback) {
        tfNode.loadLayersModel('file://' + SAVE_PATH + '/' + 'model/model.json').then((loadedModel) => {
            this.model = loadedModel;
            console.log('Loaded model from disk');
            return callback();
        });
    }

    // test() {
    //     console.log('Testing stack', this.features.shape[1]);
    //     for (let i = 0; i < this.features.shape[1] - 1; i++) {
    //         const testFeatures = this.features.slice(i, 1);
    //         const predicition = this.model.predict(testFeatures).dataSync();
    //         console.log("predicition %s, labels %s", predicition, this.labels.slice(i, 1));
    //     }
    // }

    buildFitSaveModel(callback) {
        // build the model
        this.buildModel();

        // TODO: use options from constructor
        // train the model
        this.model.fit(this.features, this.labels, this.options).then( () => {
            // save the model
            this.saveModel(callback);
        });
    }
}

module.exports = MusicAI;
