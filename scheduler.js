/*jslint node:true*/
"use strict";

var logger = require("winston");
var kue = require('kue');
var Q = require("q");
var ebay = require("./utils/ebay");
var db = require('./utils/db');
var config = require("config");
// var jobs = kue.createQueue();

var done = function () {
    db.close();
};

var schedule = function () {
    var countries = config.ebay.countries,
        numRequests = 0,
        updateRequests = [];
    // First, update the categories to the latest versions
    countries.forEach(function (globalId) {
        updateRequests.push(
            db.updateLocalCategories(globalId)
                .then(function () {
                    return db.getTopCategories(globalId);
                }, function (err) {
                    // Crash here
                    logger.error(err.stack);
                    logger.error("Cannot update local categories, exit now!");
                    done();
                    process.exit(1);
                }).then(function (topCategories) {
                    numRequests = numRequests + topCategories.length;
                    return {
                        globalId: globalId,
                        topCategories: topCategories
                    };
                }, function (err) {
                    logger.error(err.stack);
                    logger.error("Cannot get the top categories, exit now!");
                    done();
                    process.exit(1);
                })
        );
    });
    return Q.all(updateRequests)
        .then(function (sites) {
            logger.debug("Total num requests for all sites: " + numRequests);
            var newNumRequests = db.getTodayPlannedNumberOfRequests() + numRequests;
            // while (newNumRequests <= 4900) {
            //     sites.forEach(function (site) {
            //         site.forEach(function (category) {
            //             jobs.create('findItemsAdvance', {  // TODO change to findItemsAdvance and add specifics
            //                 'serviceName': 'FindingService',
            //                 'opType': 'findCompletedItems',
            //                 'appId': appId,
            //                 'GLOBAL-ID': site.globalId,

            //                 params: {
            //                     categoryId: category.Id
            //                 }
            //             }).save();
            //         });
            //     });

            //     // Lastly
            //     db.setTodayNumRequests(newNumRequests);
            //     newNumRequests = numRequests;
            // }
            // logger.warn("Quota exceeded, won't schedule anymore");
            return true;
        }, function (err) {
            logger.error(err.stack);
        });
};

module.exports.schedule = schedule;
module.exports.done = done;