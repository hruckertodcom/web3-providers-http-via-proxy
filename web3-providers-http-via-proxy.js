const fetch = require('node-fetch');
var HttpsProxyAgent = require('https-proxy-agent');
var errors = require('web3-core-helpers').errors;
var http = require('http');
var https = require('https');
// Apply missing polyfill for IE
require('cross-fetch/polyfill');
require('es6-promise').polyfill();
// import abortController if abortController is not included in node
if (typeof global !== "undefined" && !global.AbortController) {
    require('abortcontroller-polyfill/dist/polyfill-patch-fetch');
}
/**
 * HttpProvider should be used to send rpc calls over http
 */
var HttpProvider = function HttpProvider(host, proxy, options) {
    options = options || {};
    proxy = proxy || null;
    if(proxy != null) {
        proxy = new URL(proxy);
        var hpas = {
            protocol: proxy.protocol,
            host: proxy.hostname,
            port: proxy.port,
        };
        if (proxy.username && proxy.password) {
            hpas.auth = proxy.username + ':' + proxy.password;
        }
        this.proxy = true;
        this.agent = new HttpsProxyAgent(hpas);
    } else {
        this.proxy = false;
        this.agent = options.agent;
    }
    this.withCredentials = options.withCredentials;
    this.timeout = options.timeout || 0;
    this.headers = options.headers;
    this.connected = false;
    // keepAlive is true unless explicitly set to false
    const keepAlive = options.keepAlive !== false;
    this.host = host || 'http://localhost:8545';
    if (!this.agent) {
        if (this.host.substring(0, 5) === "https") {
            this.httpsAgent = new https.Agent({ keepAlive });
        }
        else {
            this.httpAgent = new http.Agent({ keepAlive });
        }
    }
};
/**
 * Should be used to make async request
 *
 * @method send
 * @param {Object} payload
 * @param {Function} callback triggered on end with (err, result)
 */
HttpProvider.prototype.send = function (payload, callback) {
    var options = {
        method: 'POST',
        body: JSON.stringify(payload)
    };
    var headers = {};
    var controller;
    if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
    }
    else if (typeof window !== 'undefined' && typeof window.AbortController !== 'undefined') {
        // Some chrome version doesn't recognize new AbortController(); so we are using it from window instead
        // https://stackoverflow.com/questions/55718778/why-abortcontroller-is-not-defined
        controller = new window.AbortController();
    }
    if (typeof controller !== 'undefined') {
        options.signal = controller.signal;
    }
    // the current runtime is node
    if (typeof XMLHttpRequest === 'undefined') {
        // https://github.com/node-fetch/node-fetch#custom-agent
        if(!this.proxy) {
            var agents = { httpsAgent: this.httpsAgent, httpAgent: this.httpAgent };
            if (this.agent) {
                agents.httpsAgent = this.agent.https;
                agents.httpAgent = this.agent.http;
            }
            if (this.host.substring(0, 5) === "https") {
                options.agent = agents.httpsAgent;
            }
            else {
                options.agent = agents.httpAgent;
            }
        } else {
            options.agent = this.agent;
        }
    }
    if (this.headers) {
        this.headers.forEach(function (header) {
            headers[header.name] = header.value;
        });
    }
    // Default headers
    if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    // As the Fetch API supports the credentials as following options 'include', 'omit', 'same-origin'
    // https://developer.mozilla.org/en-US/docs/Web/API/fetch#credentials
    // To avoid breaking change in 1.x we override this value based on boolean option.
    if (this.withCredentials) {
        options.credentials = 'include';
    }
    else {
        options.credentials = 'omit';
    }
    options.headers = headers;
    if (this.timeout > 0 && typeof controller !== 'undefined') {
        this.timeoutId = setTimeout(function () {
            controller.abort();
        }, this.timeout);
    }
    var success = function (response) {
        if (this.timeoutId !== undefined) {
            clearTimeout(this.timeoutId);
        }
        // Response is a stream data so should be awaited for json response
        response.json().then(function (data) {
            callback(null, data);
        }).catch(function (error) {
            callback(errors.InvalidResponse(response));
        });
    };
    var failed = function (error) {
        if (this.timeoutId !== undefined) {
            clearTimeout(this.timeoutId);
        }
        if (error.name === 'AbortError') {
            callback(errors.ConnectionTimeout(this.timeout));
        }
        callback(errors.InvalidConnection(this.host));
    };
    fetch(this.host, options)
        .then(success.bind(this))
        .catch(failed.bind(this));
};
HttpProvider.prototype.disconnect = function () {
    //NO OP
};
/**
 * Returns the desired boolean.
 *
 * @method supportsSubscriptions
 * @returns {boolean}
 */
HttpProvider.prototype.supportsSubscriptions = function () {
    return false;
};
module.exports = HttpProvider;
