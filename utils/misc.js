/*jslint node:true*/
"use strict";

require("date-utils");
var fs = require("fs");
var ebay = require("ebay-api");
var config = require("config");
var redis = require("redis");
var timezoneJS = require('timezone-js');
var tz = timezoneJS.timezone;

tz.transport = function (opts) {
    return fs.readFileSync(opts.url, 'utf8');
};
tz.loadingScheme = tz.loadingSchemes.MANUAL_LOAD;
tz.loadZoneJSONData('tz.json', true);

var todayInPST = function () {
    var now = new timezoneJS.Date('US/Pacific'),
        today = new timezoneJS.Date(now.getYear(), now.getMonth(), now.getDate(),
            'US/Pacific');
    return today.toISOString();
};

/**
 * Returns a random integer between min and max
 * @param min the lower bound
 * @param max the upper bound
 * @return a random int
 */
var getRandomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Get a random time observation, between now and some point in the past.
 * @param daysBack how many days back
 * @return a random Date object
 */
var randomTimeObservation = function (daysBack) {
    // Be careful, date-utils mutate the date objects!
    var now = new Date(),
        nowInt = now.getTime(),  // otherwise, now would not be available later on
        past = now.add({ days: -daysBack });
    return new Date(getRandomInt(past.getTime(), nowInt));
};

/**
 * Create a Redis client for Kue. This is here to allow sharing code.
 */
var createRedisClient = function () {
    var client = redis.createClient(config.Redis.port, config.Redis.host);
    if (config.Redis.password) {
        client.auth(config.Redis.password);
    }
    return client;
};

module.exports.todayInPST = todayInPST;
module.exports.randomTimeObservation = randomTimeObservation;
module.exports.createRedisClient = createRedisClient;
