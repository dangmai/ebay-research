/*jslint node:true*/
"use strict";

var db = require("./utils/db");
var logger = require("winston");
var Q = require("q");
var csv = require("ya-csv");
var config = require("config");

/**
 * Determine whether or not to accept a listing.
 * @return Boolean
 */
var acceptListing = function (listing) {
    return listing.sellingStatus.sellingState === "EndedWithSales";
};

var fieldRegistry = [];
var headerRow = [];

/**
 * Add a column to the CSV file.
 * @param header the header to the column.
 * @param callback the callback to generate data for a field in the column. The
 * callback will receive every listing as the first argument.
 */
var addField = function (header, callback) {
    fieldRegistry[header] = callback;
    fieldRegistry.push({
        header: header,
        callback: callback
    });
    headerRow.push(header);
};

/**
 * Generate a row for the CSV file
 */
var generateRow = function (listing) {
    var row = [],
        fieldPromises = [];
    fieldRegistry.forEach(function (fieldWorker) {
        fieldPromises.push(Q.when(fieldWorker.callback(listing), function (fieldValue) {
            return fieldValue;
        }, function (err) {
            logger.error(err.stack);
        }));
    });
    return Q.all(fieldPromises).then(function (fieldValues) {
        row = row.concat(fieldValues);
        return row;
    });
};

/**
 * Add all the necessary fields to the CSV file
 */
var addNecessaryFields = function () {
    addField("category", function (listing) {
        return db.getTopParentCategory(listing.globalId,
            listing.primaryCategory.categoryId);
    });
    addField("id", function (listing) {
        return listing.itemId;
    });
    addField("title", function (listing) {
        return listing.title;
    });
    addField("condition", function (listing) {
        if (listing.condition) {
            return listing.condition.conditionId;
        }
        return null;
    });
    addField("conditionDisplayName", function (listing) {
        if (listing.condition) {
            return listing.condition.conditionDisplayName;
        }
        return null;
    });
    addField("country", function (listing) {
        return listing.country;
    });
    addField("sellerFeedbackScore", function (listing) {
        return listing.sellerInfo.feedbackScore;
    });
    addField("sellerPositiveFeedbackPercent", function (listing) {
        return listing.sellerInfo.positiveFeedbackPercent;
    });
    addField("sellerFeedbackRatingStar", function (listing) {
        return listing.sellerInfo.feedbackRatingStar;
    });
    addField("topRatedSeller", function (listing) {
        return listing.sellerInfo.topRatedSeller;
    });
    addField("shipToLocation", function (listing) {
        return listing.shippingInfo.shipToLocations;
    });
    addField("oneDayShippingAvailable", function (listing) {
        return listing.shippingInfo.oneDayShippingAvailable;
    });
    addField("handlingTime", function (listing) {
        return listing.shippingInfo.handlingTime;
    });
    addField("returnsAccepted", function (listing) {
        return listing.returnsAccepted;
    });
    addField("dayEnded", function (listing) {
        return new Date(listing.listingInfo.endTime).getDay();
    });
    addField("startTime", function (listing) {
        return listing.listingInfo.startTime;
    });
    addField("endTime", function (listing) {
        return listing.listingInfo.endTime;
    });
    addField("timeObserved", function (listing) {
        return listing.timeObserved;
    });
    addField("listingDuration", function (listing) {
        var startDate = new Date(listing.listingInfo.startTime),
            endDate = new Date(listing.listingInfo.endTime);
        return startDate.getSecondsBetween(endDate);
    });
    addField("listingType", function (listing) {
        return listing.listingInfo.listingType;
    });
    addField("bestOfferEnabled", function (listing) {
        return listing.listingInfo.bestOfferEnabled;
    });
    addField("buyItNowAvailable", function (listing) {
        return listing.listingInfo.buyItNowAvailable;
    });
    addField("gift", function (listing) {
        return listing.listingInfo.gift;
    });
    addField("globalId", function (listing) {
        return listing.globalId;
    });
    // addField("requestedGlobalId", function (listing) {
    //     return listing.requestedGlobalId;
    // });
    addField("bidCount", function (listing) {
        return listing.sellingStatus.bidCount;
    });
    addField("endingPrice", function (listing) {
        // the field is called convertedCurrentPrice; however, as the listings
        // have all been finished, this is the ending price for the listing.
        // Also, the converted current price currency depends on the eBay site 
        // that we polled
        var priceObj = listing.sellingStatus.convertedCurrentPrice,
            key;
        for (key in priceObj) {  // Get the first value of this object
            if (priceObj.hasOwnProperty(key)) {
                return priceObj[key];
            }
        }
    });
    addField("topRatedListing", function (listing) {
        return listing.topRatedListing;
    });
    addField("isMultiVariationListing", function (listing) {
        return listing.isMultiVariationListing;
    });
    addField("autoPay", function (listing) {
        return listing.autoPay;
    });
    addField("itemURL", function (listing) {
        return listing.viewItemURL;
    });
};

/**
 * Read the database, export relevant data to CSV file.
 */
var exportToCsv = function () {
    var cursor = db.getListingCursor(),
        deferred = Q.defer(),
        promises = [],
        rowPromise,
        writer = csv.createCsvFileWriter(config.general.csv),
        counter = 0; // debug

    return Q.spread([
        db.getDistinctGlobalIds(),
        db.getAvailableLocalSites()
    ], function (allGlobalIds, availableGlobalIds) {
        var updatePromises = [];
        allGlobalIds.forEach(function (globalId) {
            if (availableGlobalIds.indexOf(globalId) === -1) {
                updatePromises.push(db.updateLocalCategories(globalId));
            }
        });
        return Q.all(updatePromises);
    }).then(function () {
        addNecessaryFields();
        writer.writeRecord(headerRow);
        cursor.each(function (err, listing) {
            if (err) {
                deferred.reject(new Error(err));
            }
            if (listing === null) {
                Q.all(promises).then(function () {
                    writer.addListener('drain', function () {
                        // Only resolve when writer has finished writing
                        // BEWARE there might be a problem here, in which
                        // the script writes faster than row is being added!
                        deferred.resolve(true);
                    });
                }, function (err) {
                    logger.error(err);
                });
            }
            if (acceptListing(listing)) {
                rowPromise = generateRow(listing);
                rowPromise.then(function (row) {
                    logger.debug("Writing row to CSV file");
                    writer.writeRecord(row);
                });
                promises.push(rowPromise);
            }
            counter = counter + 1;
        });
        return deferred.promise;
    }, function (err) {
        logger.error(err.stack);
        process.exit(1);
    });
};

module.exports.exportToCsv = exportToCsv;