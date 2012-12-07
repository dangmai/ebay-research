/*jslint node:true*/
"use strict";

var db = require("./utils/db");
var logger = require("winston");

var analyze = function () {
    return db.getDistinctTimesObserved()
        .then(function (endingTimes) {
            endingTimes.forEach(function (time) {
                logger.debug(time);
            });
        });
};

module.exports.analyze = analyze;