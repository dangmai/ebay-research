/*jslint node:true*/
"use strict";

var ebay = require("./ebay");
var Q = require("q");
var mongo = require("mongoskin");
var config = require("config");
var logger = require("winston");
var db = mongo.db(config.Mongo.address, { safe: true });
db.collection("categories").ensureIndex({ globalId: 1 }, true, function (err) {
    if (err) {
        logger.error("Cannot ensure index for the categories collection");
        process.exit(2);
        db.close();
    }
});

/*
 * Given an eBay site, count the number of top categories
 */
var getNumberOfTopCategories = function (globalId) {};

/**
 * Get the local category structure for an ebay site.
 * @param String globalId the GlobalId for the ebay site.
 * @return a promise for the category structure.
 */
var getLocalCategories = function (globalId) {
    logger.info("Get local categories from site with GlobalId " + globalId);
    var deferred = Q.defer();
    debugger;
    db.collection('categories').findOne({globalId: globalId},
        function (err, siteCategories) {
            debugger;
            if (err) {
                deferred.reject(err);
            }
            deferred.resolve(siteCategories);
        });
    return deferred.promise;
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
        return Q.fcall(true);
    });
};

var getTopCategoryOf = function (childCategory) {};

var getTopCategoriesForSite = function (globalId) {
    var deferred = Q.defer();
    db.collection("categories").findOne({globalId: globalId}, function (err, siteCategories) {
        if (err) {
            deferred.reject(new Error(err));
        }
        var categories = siteCategories.data.CategoriesArray;
        return categories;
    });
    return deferred.promise;
};

var close = function () {
    db.close();
};

module.exports.getNumberOfTopCategories = getNumberOfTopCategories;
module.exports.updateLocalCategories = updateLocalCategories;
module.exports.getLocalCategories = getLocalCategories;
module.exports.close = close;