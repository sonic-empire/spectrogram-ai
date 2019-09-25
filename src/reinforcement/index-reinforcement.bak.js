require('dotenv').config();
const debugReinforcement = require('debug')('reinforcement');
const MusicAIReinforcement = require('./ai-reinforcement');
const musicAIReinforcement = new MusicAIReinforcement({
    numActions: 4,
    inputSize: 2,
    temporalWindow: 5,
});
const assert = require('assert');

const launchEasyNumbers = async () => {
    const inputSize = 2;
    let target = 5;
    let actor = 0;
    let distanceBefore = differrence(target, actor);
    let round = 0;
    while (true) {
        round++;
        debugReinforcement('\n\n---------------------------\nRound', round);
        const inputs = [actor, target];
        debugReinforcement('actor', actor, 'target', target);
        console.table(inputs);

        assert.equal(inputs.length, inputSize, "The Input Size dose not match the Inputs Array length");
        const action = await musicAIReinforcement.step(inputs);
        debugReinforcement('ACTION', action);

        if (action) {
            if (action === 0) {
                debugReinforcement('=');
                // do nothing
            } else if (action === 1) {
                debugReinforcement('+');
                actor++; // up
            }  else if (action === 2) {
                debugReinforcement('-');
                actor--; // down
            }
            else {
                console.log('unknown action', action)
            }
        }
        target = fakeOutput(target);
        const distance = differrence(target, actor);
        debugReinforcement("target, actor", target, actor, "distanceBefore", distanceBefore, 'distance', distance);
        if (distance < distanceBefore) {
            debugReinforcement("REWARD");
            musicAIReinforcement.reward(2);
        } else if (distance > distanceBefore) {
            debugReinforcement("PENALTY");
            musicAIReinforcement.penality(-1);
        } else {
            musicAIReinforcement.reward(1);
        }
        distanceBefore = distance;
    }
};

const differrence = (one, two) => {
    return Math.abs(one - two);
};

let direction = 1;
const fakeOutput = (target) => {
    target += direction;
    if (Math.abs(target) >= 10) {
        direction = -direction;
    }
    return target;
};

launchEasyNumbers();
