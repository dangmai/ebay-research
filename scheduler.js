/*jslint node:true*/
"use strict";

var logger = require("winston");
var kue = require('kue');
var redis = require("redis");
var Q = require("q");
var ebay = require("./utils/ebay");
var db = require('./utils/db');
var misc = require('./utils/misc');
var config = require("config");

kue.redis.createClient = misc.createRedisClient;
var jobs = kue.createQueue();

var done = function () {
    db.close();
};

var schedule = function () {
    var countries = config.ebay.countries,
        updateRequests = [],
        kueErrorHandler;

    kueErrorHandler = function (err) {
        logger.error(err);
    };
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
            var eachTimeObservationRequests = 0,
                createJobForSite;
            sites.forEach(function (site) {
                eachTimeObservationRequests = eachTimeObservationRequests + site.topCategories.length;
            });
            return db.getTodayPlannedNumberOfRequests()
                .then(function (numCurrentlyPlannedRequests) {
                    var randomEndingTime,
                        numRequests = numCurrentlyPlannedRequests + eachTimeObservationRequests;
                    while (numRequests <= config.ebay.requestsPerDay) {
                        randomEndingTime = misc.randomTimeObservation(config.ebay.history);
                        sites.forEach(function (site) {
                            site.topCategories.forEach(function (cat) {
                                var title = "Find completed items for site " +
                                    site.globalId + " in category " +
                                    cat.CategoryName + " for ending time " +
                                    randomEndingTime.toISOString();
                                jobs.create('findCompletedItems', {
                                    title: title,
                                    category: cat.CategoryID,
                                    globalId: site.globalId,
                                    endTime: randomEndingTime.toISOString()
                                }).save();
                            });
                        });
                        numRequests = numRequests + eachTimeObservationRequests;
                    }
                    logger.warning("Quota for today exceeded (" + numRequests + "), stop scheduling");
                    return db.setTodayPlannedNumberOfRequests(numRequests - eachTimeObservationRequests);
                });
        }, function (err) {
            logger.error(err.stack);
        });
};

module.exports.schedule = schedule;
module.exports.done = done;
