/*jslint node:true*/
"use strict";

var db = require("./utils/db");
var logger = require("winston");
var Q = require("q");
var csv = require("ya-csv");

/**
 * Determine whether or not to accept a listing.
 * @return Boolean
 */
var acceptListing = function (listing) {
    return listing.sellingStatus.sellingState === "EndedWithSales";
};

var fieldRegistry = [];
var rows = [[]];

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
    rows[0].push(header);
};

/**
 * Add a row to the CSV file
 */
var addRow = function (listing) {
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
        rows.push(row);
        return row;
    });
};

/**
 * Add all the necessary fields to the CSV file
 */
var addNecessaryFields = function () {
    addField("category", function (listing) {
        return db.getTopParentCategory(listing.globalId, listing.primaryCategory.categoryId);
    });
    addField("id", function (listing) {
        return listing.itemId;
    });
    addField("title", function (listing) {
        return listing.title;
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
};

var exportToCsv = function () {
    var cursor = db.getListingCursor(),
        deferred = Q.defer(),
        promises = [],
        writer = csv.createCsvFileWriter("output.csv"),
        counter = 0; // debug

    addNecessaryFields();
    cursor.each(function (err, listing) {
        if (err) {
            deferred.reject(new Error(err));
        }
        if (listing === null || counter === 60) {
            Q.all(promises).then(function () {
                writer.addListener('drain', function () {
                    // Only resolve when writer has finished writing
                    // BEWARE there might be a problem here, in which
                    // the script writes faster than row is being added!
                    deferred.resolve(true);
                });
                rows.forEach(function (row) {
                    logger.debug("Writing row to CSV file");
                    writer.writeRecord(row);
                });
            }, function (err) {
                logger.error(err);
            });
        }
        if (acceptListing(listing)) {
            promises.push(addRow(listing));
        }
        counter = counter + 1;
    });
    return deferred.promise;
};

module.exports.exportToCsv = exportToCsv;