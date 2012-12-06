/*jslint node:true*/
"use strict";

var ebay = require("./ebay");
var Q = require("q");
var mongo = require("mongoskin");
var config = require("config");
var logger = require("winston");
var misc = require("./misc");
var db = mongo.db(config.Mongo.address, { safe: true });
db.collection("categories").ensureIndex({ globalId: 1 }, true, function (err) {
    if (err) {
        logger.error("Cannot ensure index for the categories collection");
        process.exit(2);
        db.close();
    }
});
db.collection("requests").ensureIndex({ date: 1 }, true, function (err) {
    if (err) {
        logger.error("Cannot ensure index for the requests collection");
        process.exit(2);
        db.close();
    }
});

/**
 * Get the local category structure for an ebay site.
 * @param String globalId the GlobalId for the ebay site.
 * @return a promise for the category structure.
 */
var getLocalCategories = function (globalId) {
    logger.info("Get local categories from site with GlobalId " + globalId);
    var deferred = Q.defer();
    db.collection('categories').findOne({globalId: globalId},
        function (err, siteCategories) {
            if (err) {
                deferred.reject(err);
            }
            deferred.resolve(siteCategories);
        });
    return deferred.promise;
};

/*
 * Given an eBay site, get the top categories from the local database.
 * @param String globalId the GlobalId of the site to use.
 * @return Promise a promise for the hash of all the top categories.
 */
var getTopCategories = function (globalId) {
    return getLocalCategories(globalId)
        .then(function (categories) {
            var allCategories = categories.data.CategoryArray.Category;
            return allCategories.filter(function (category) {
                return (category.CategoryLevel === "1");
            });
        });
};

/**
 * Update the categories for some eBay site, store the results in Mongo.
 */
var updateLocalCategories = function (globalId) {
    logger.debug("Update local categories for " + globalId);
    return Q.spread([
        ebay.getCategories(globalId, true),
        getLocalCategories(globalId)
    ], function (remoteCategories, localCategories) {
        logger.debug("Got both remote and local categories' version");
        logger.debug("Remote categories version: " + remoteCategories.Version);
        if (localCategories && remoteCategories.Version === localCategories.data.Version) {
            logger.debug("No need to update categories structure for " + globalId);
        } else {
            if (localCategories) {
                logger.debug("Local categories version: " + localCategories.data.Version);
            }
            logger.info("Local categories update needed");
            return ebay.getCategories(globalId, false)
                .then(function (newCategories) {
                    logger.debug("New categories received!");
                    var deferred = Q.defer(),
                        upsertDone;
                    upsertDone = function (err) {
                        logger.info("Upsert categories for " + globalId + " into database completed");
                        if (err) {
                            deferred.reject(new Error(err));
                        }
                        deferred.resolve(true);
                    };
                    if (!localCategories) {
                        logger.info("Inserting category structure for " + globalId);
                        db.collection("categories").insert({
                            globalId: globalId,
                            data: newCategories
                        }, upsertDone);
                    } else {
                        logger.info("Updating category structure for " + globalId);
                        db.collection("categories").update({ globalId: globalId }, {
                            globalId: globalId,
                            data: newCategories
                        }, upsertDone);
                    }
                    return deferred.promise;
                });
        }
        return Q.fcall(function () { return true; });
    });
};

var getTopCategoryOf = function (childCategory) {};

/**
 * Helper function get the whole requests object for today.
 */
var getTodayNumberOfRequests = function () {
    var deferred = Q.defer();
    db.collection("requests").findOne({ date: misc.todayInPST() }, function (err, day) {
        if (err) {
            deferred.reject(new Error(err));
        }
        deferred.resolve(day);
    });
    return deferred.promise;
};

/**
 * Get the number of API requests that has been planned for today.
 * @return a promise for the planned number of requests.
 */
var getTodayPlannedNumberOfRequests = function () {
    return getTodayNumberOfRequests()
        .then(function (day) {
            if (!day) {
                return 0;
            }
            return day.plannedRequests;
        });
};

/**
 * Set the number of API requests that has been planned for today.
 * @return a promise for the new planned number of requests.
 */
var setTodayPlannedNumberOfRequests = function (numRequests) {
    var deferred = Q.defer(),
        today = misc.todayInPST();
    db.collection("requests").update({ date: today },
        { $set: {date: today, plannedRequests: numRequests }},
        { upsert: true },
        function (err) {
            if (err) {
                deferred.reject(new Error(err));
            }
            deferred.resolve(numRequests);
        });
    return deferred.promise;
};

/**
 * Increment the actual API requests for today.
 * @return a promise the for new actual number of requests.
 */
var incrementTodayActualNumberOfRequests = function () {
    var deferred = Q.defer(),
        today = misc.todayInPST();
    db.collection("requests").update({ date: today },
        { $set: { date: today }, $inc: { "actualRequests": 1 } },
        { upsert: true },
        function (err) {
            if (err) {
                deferred.reject(new Error(err));
            }
            deferred.resolve(true);
        });
    return deferred.promise;
};

var close = function () {
    db.close();
};

module.exports.getTopCategories = getTopCategories;
module.exports.updateLocalCategories = updateLocalCategories;
module.exports.getLocalCategories = getLocalCategories;
module.exports.getTodayPlannedNumberOfRequests = getTodayPlannedNumberOfRequests;
module.exports.setTodayPlannedNumberOfRequests = setTodayPlannedNumberOfRequests;
module.exports.incrementTodayActualNumberOfRequests = incrementTodayActualNumberOfRequests;
module.exports.close = close;