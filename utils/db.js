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
        logger.error(err);
        process.exit(2);
        db.close();
    }
});
db.collection("requests").ensureIndex({ date: 1 }, true, function (err) {
    if (err) {
        logger.error("Cannot ensure index for the requests collection");
        logger.error(err);
        process.exit(2);
        db.close();
    }
});
db.collection("listings").ensureIndex({ timeObserved: 1, itemId: 1 }, function (err) {
    if (err) {
        logger.error("Cannot ensure index for the listings collection");
        logger.error(err);
        process.exit(2);
        db.close();
    }
});

// So that we don't have to poll MongoDB everytime a category structure is needed
var categoryCache = {};

/**
 * Get the local category structure for an ebay site.
 * @param String globalId the GlobalId for the ebay site.
 * @return a promise for the category structure.
 */
var getLocalCategories = function (globalId) {
    logger.info("Get local categories from site with GlobalId " + globalId);
    if (categoryCache[globalId]) {
        logger.debug("Category existed within cache. Returning now!");
        return categoryCache[globalId];
    }
    var deferred = Q.defer();
    db.collection('categories').findOne({globalId: globalId},
        function (err, siteCategories) {
            if (err) {
                deferred.reject(err);
            }
            categoryCache[globalId] = siteCategories;
            deferred.resolve(siteCategories);
        });
    return deferred.promise;
};

/**
 * Given an eBay site, get the top categories from the local database.
 * @param String globalId the GlobalId of the site to use.
 * @return Promise a promise for the hash of all the top categories.
 */
var getTopCategories = function (globalId) {
    return Q.when(getLocalCategories(globalId), function (categories) {
        var allCategories = categories.data.CategoryArray.Category;
        return allCategories.filter(function (category) {
            return (category.CategoryLevel === "1" && !category.Expired);
        });
    });
};

/**
 * Get the name of a category given the ebay site and its id.
 */
var getCategoryName = function (globalId, categoryId) {
    logger.debug("Getting category name for id " + categoryId + " in " + globalId);
    return Q.when(getLocalCategories(globalId), function (categories) {
        var allCategories = categories.data.CategoryArray.Category;
        return allCategories.filter(function (category) {
            return category.CategoryID === categoryId;
        })[0].CategoryName;
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

var topParentCategoryCache = {};

/**
 * Find the top parent category of a certain category
 * @param globalId the site to search for
 * @param childCategoryId the id of the category of which to find the parent
 * @return a promise for the id of the top category
 */
var getTopParentCategory = function (globalId, childCategoryId) {
    logger.debug("Getting top parent category");
    return Q.when(getLocalCategories(globalId), function (siteCategories) {
        // Check the cache so that it doesn't have to traverse the object unnecessarily
        if (topParentCategoryCache[globalId] && topParentCategoryCache[globalId][childCategoryId]) {
            logger.debug("Returning top parent category from cache");
            return Q.fcall(function () {
                return topParentCategoryCache[globalId][childCategoryId];
            });
        }
        var categories = siteCategories.data.CategoryArray.Category,
            childCategory;
        childCategory = categories.filter(function (category) {
            return category.CategoryID === childCategoryId.toString();
        })[0];
        while (childCategory && childCategory.CategoryID !== childCategory.CategoryParentID) {
            childCategory = categories.filter(function (category) {
                return category.CategoryID === childCategory.CategoryParentID;
            })[0];
        }
        if (!childCategory || !childCategory.CategoryParentID) {
            logger.debug(childCategory);
            throw new Error("Cannot find top parent category for category " +
                childCategoryId + " in " + globalId);
        }
        if (!topParentCategoryCache[globalId]) {
            topParentCategoryCache[globalId] = {};
        }
        topParentCategoryCache[globalId][childCategoryId] = childCategory.CategoryParentID;
        return childCategory.CategoryParentID;
    });
};

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
            if (!day || !day.plannedRequests) {
                return 0;
            }
            return day.plannedRequests;
        });
};

/**
 * Get the number of API requests that has been used for today.
 * @return a promise for the planned number of requests.
 */
var getTodayActualNumberOfRequests = function () {
    return getTodayNumberOfRequests()
        .then(function (day) {
            if (!day || !day.actualRequests) {
                return 0;
            }
            return day.actualRequests;
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

/**
 * Insert a listing into the listings collection.
 * @param listing the listing to insert.
 */
var insertListing = function (listing) {
    var deferred = Q.defer();
    db.collection("listings").update({ "itemId": listing.itemId },
        listing,
        { upsert: true},
        function (err) {
            if (err) {
                deferred.reject(new Error(err));
            }
            deferred.resolve(true);
        });
    return deferred.promise;
};

/**
 * Get a listing from the itemid
 * @param itemId the itemId of the listing to search for
 * @return a promise for the listing
 */
var getListing = function (itemId) {
    var deferred = Q.defer();
    db.collection("listings").findOne({ "itemId": itemId },
        function (err, listing) {
            if (err) {
                deferred.reject(new Error(err));
            }
            deferred.resolve(listing);
        });
    return deferred.promise;
};

/**
 * Remove a listing from the itemid
 * @param itemId the itemId of the listing to search for
 * @return a promise for the operation completion
 */
var removeListing = function (itemId) {
    var deferred = Q.defer();
    db.collection("listings").remove({ "itemId": itemId },
        function (err) {
            if (err) {
                deferred.reject(new Error(err));
            }
            deferred.resolve(true);
        });
    return deferred.promise;
};

/**
 * Get all the ending times that we choose to observe.
 * @return a promise for the list of all the ending time strings.
 */
var getDistinctTimesObserved = function () {
    var deferred = Q.defer();
    db.collection("listings").distinct("timeObserved", function (err, endingTimes) {
        if (err) {
            deferred.reject(new Error(err));
        }
        deferred.resolve(endingTimes);
    });
    return deferred.promise;
};

/**
 * Get all the distinct globalIds in our dataset.
 * @return a promise for the list of all the globalIds.
 */
var getDistinctGlobalIds = function () {
    logger.info("Getting the distinct globalIds");
    var deferred = Q.defer();
    db.collection("listings").distinct("globalId", function (err, globalIds) {
        if (err) {
            deferred.reject(new Error(err));
        }
        deferred.resolve(globalIds);
    });
    return deferred.promise;
};

/**
 * Get the list of sites whose category structures that we have available locally.
 * @return the promise of the list of sites' globalIds.
 */
var getAvailableLocalSites = function () {
    logger.info("Getting the available local sites");
    var deferred = Q.defer();
    db.collection('categories').find().toArray(function (err, siteCategories) {
        if (err) {
            deferred.reject(err);
        }
        deferred.resolve(siteCategories.map(function (site) {
            return site.globalId;
        }));
    });
    return deferred.promise;
};

/**
 * Get the cursor for listings collection.
 * @return the cursor object.
 */
var getListingCursor = function () {
    return db.collection("listings").find({
        "sellingStatus.sellingState": "EndedWithSales"
    });
};

/**
 * Count the number of documents for a cursor.
 * @param cursor the cursor object to count.
 * @return a promise for the count number.
 */
var cursorCount = function (cursor) {
    var deferred = Q.defer();
    cursor.count(function (err, count) {
        if (err) {
            deferred.reject(new Error(err));
        }
        deferred.resolve(count);
    });
    return deferred.promise;
};

/**
 * Close the database connection
 */
var close = function () {
    db.close();
};

module.exports.getTopCategories = getTopCategories;
module.exports.updateLocalCategories = updateLocalCategories;
module.exports.getLocalCategories = getLocalCategories;
module.exports.getCategoryName = getCategoryName;
module.exports.getTodayPlannedNumberOfRequests = getTodayPlannedNumberOfRequests;
module.exports.setTodayPlannedNumberOfRequests = setTodayPlannedNumberOfRequests;
module.exports.getTodayActualNumberOfRequests = getTodayActualNumberOfRequests;
module.exports.incrementTodayActualNumberOfRequests = incrementTodayActualNumberOfRequests;
module.exports.insertListing = insertListing;
module.exports.removeListing = removeListing;
module.exports.getListing = getListing;
module.exports.getDistinctTimesObserved = getDistinctTimesObserved;
module.exports.getDistinctGlobalIds = getDistinctGlobalIds;
module.exports.getAvailableLocalSites = getAvailableLocalSites;
module.exports.getTopParentCategory = getTopParentCategory;
module.exports.getListingCursor = getListingCursor;
module.exports.cursorCount = cursorCount;
module.exports.close = close;