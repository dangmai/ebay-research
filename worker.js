/*jslint node:true*/
"use strict";

var kue = require('kue'),
    cluster = require('cluster'),
    mongo = require('mongoskin'),
    ebay = require("./utils/ebay"),
    db = require("./utils/db"),
    misc = require("./utils/misc"),
    config = require("config"),
    logger = require("winston"),
    Q = require("q"),
    jobs;
kue.redis.createClient = misc.createRedisClient;
jobs = kue.createQueue();

var close = function () {
    db.close();
};

var process = function () {
    jobs.process('findCompletedItems', function (job, done) {
        db.getTodayActualNumberOfRequests()
            .then(function (numRequests) {
                if (numRequests >= 4900) {
                    done("API quotas for today exceeded, stop scraping now!");
                } else {
                    ebay.findCompletedItems(
                        config.ebay.app_id,
                        job.data.globalId,
                        job.data.category,
                        job.data.endTime
                    ).then(function (listings) {
                        var insertRequests = [];
                        listings.forEach(function (listing) {
                            listing.requestedGlobalId = job.data.globalId;
                            listing.timeObserved = job.data.endTime;
                            insertRequests.push(db.insertListing(listing));
                        });
                        return Q.all(insertRequests);
                    }).then(function () {
                        done();
                    }).fail(function (err) {
                        done(err);
                    });
                }
            });
    });
};

module.exports.process = process;
module.exports.close = close;
