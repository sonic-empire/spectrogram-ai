const ReImprove = require('reimprovejs/dist/reimprove.js');

class MusicAIReinforcement {
    constructor(options = {}) {
        this.options = Object.assign({
            modelFitConfig: {              // Exactly the same idea here by using tfjs's model's
                epochs: 1,                        // fit config.
                stepsPerEpoch: 16
            },
            numActions: 2,                 // The number of actions your agent can choose to do
            inputSize: 100,                // Inputs size (10x10 image for instance)
            temporalWindow: 1,             // The window of data which will be sent yo your agent
            // For instance the x previous inputs, and what actions the agent took
        }, options);
        this.options.totalInputSize = (this.options.inputSize + this.options.numActions) * this.options.temporalWindow + this.options.inputSize;
        this.buildModel();
        this.buildAgent();
    }

    buildModel() {
        this.network = new ReImprove.NeuralNetwork();
        this.network.InputShape = [this.options.totalInputSize];
        this.network.addNeuralNetworkLayers([
            {type: 'dense', units: 32, activation: 'relu'},
            {type: 'dense', units: this.options.numActions, activation: 'softmax'}
        ]);

        // Now we initialize our model, and start adding layers
        this.model = new ReImprove.Model.FromNetwork(this.network, this.options.modelFitConfig);

        // Finally compile the model, we also exactly use tfjs's optimizers and loss functions
        // (So feel free to choose one among tfjs's)
        this.model.compile({loss: 'meanSquaredError', optimizer: 'sgd'})
    }

    buildAgent() {
        // Every single field here is optionnal, and has a default value. Be careful, it may not
        // fit your needs ...

        const teacherConfig = {
            lessonsQuantity: 10,                   // Number of training lessons before only testing agent
            lessonsLength: 100,                    // The length of each lesson (in quantity of updates)
            lessonsWithRandom: 2,                  // How many random lessons before updating epsilon's value
            epsilon: 1,                            // Q-Learning values and so on ...
            epsilonDecay: 0.995,                   // (Random factor epsilon, decaying over time)
            epsilonMin: 0.05,
            gamma: 0.8                             // (Gamma = 1 : agent cares really much about future rewards)
        };

        const agentConfig = {
            model: this.model,                          // Our model corresponding to the agent
            agentConfig: {
                memorySize: 5000,                      // The size of the agent's memory (Q-Learning)
                batchSize: 128,                        // How many tensors will be given to the network when fit
                temporalWindow: this.options.temporalWindow         // The temporal window giving previous inputs & actions
            }
        };

        this.academy = new ReImprove.Academy();    // First we need an academy to host everything
        this.teacher = this.academy.addTeacher(teacherConfig);
        this.agent = this.academy.addAgent(agentConfig);

        this.academy.assignTeacherToAgent(this.agent, this.teacher);
    }

    reward(rew = 1) {
        this.academy.addRewardToAgent(this.agent, rew)        // Give a nice reward if the agent did something nice !
    }

    penality(pen = -1) {
        this.academy.addRewardToAgent(this.agent, pen)        // Give a bad reward to the agent if he did something wrong
    }

    async step (inputs) {
        const result = await this.academy.step([               // Let the magic operate ...
            {teacherName: this.teacher, agentsInput: inputs}
        ]);
        return result.get(this.agent)
    }

}

module.exports = MusicAIReinforcement;
