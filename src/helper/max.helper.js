const debugHelperMax = require('debug')('helper:max');
const MAX4N_HOST = process.env.MAX4N_HOST || 'http://localhost:3200';
const request = require('request');

/**
 * Sends a knob value to m4N
 * @param value
 * @return {*}
 */
exports.controlMaxForLive = (value, callback) => {
    if (value != null) {
        debugHelperMax('Turn knob value', value);
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
