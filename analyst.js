/*jslint node:true*/
"use strict";

var db = require("./utils/db");
var logger = require("winston");
var Q = require("q");

var analyze = function () {
    // return db.getDistinctTimesObserved()
    //     .then(function (endingTimes) {
    //         endingTimes.forEach(function (time) {
    //             logger.debug(time);
    //         });
    //     });
    return db.getTopParentCategory("EBAY-US", 1)
        .then(function (category) {
            logger.debug(category);
            return Q.fcall(function () { return true; });
        });
};

module.exports.analyze = analyze;