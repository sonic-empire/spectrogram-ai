const MAX4N_HOST = process.env.MAX4N_HOST || 'http://localhost:3200';
const request = require('request');

/**
 * Sends a knob value to m4N
 * @param prediction
 * @return {*}
 */
exports.controlMaxForLive = (prediction, callback) => {
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
