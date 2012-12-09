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
 * Helper function to get the key-value of an object, without knowing the key.
 * This assumes that there is only one property inside the object!
 * @param obj the object to get the key-value from
 * @returns an array with 2 elements: the first is the key, the second is the
 * value.
 */
var getKeyValue = function (obj) {
    var key;
    for (key in obj) {  // Get the first key of this object
        return [key, obj[key]];
    }
};

/**
 * Add all the necessary fields to the CSV file
 */
var addNecessaryFields = function () {
    addField("topCategory", function (listing) {
        return db.getTopParentCategory(listing.globalId,
            listing.primaryCategory.categoryId);
    });
    addField("numCategories", function (listing) {
        if (listing.secondaryCategory) {
            return 2;
        }
        return 1;
    });
    addField("id", function (listing) {
        return listing.itemId;
    });
    addField("title", function (listing) {
        return listing.title;
    });
    addField("subtitle", function (listing) {
        return listing.subtitle;
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
    addField("shipToLocations", function (listing) {
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
    addField("buyItNowPriceCurrency", function (listing) {
        if (listing.listingInfo.convertedBuyItNowPrice) {
            return getKeyValue(listing.listingInfo.convertedBuyItNowPrice)[0];
        }
        return null;
    });
    addField("buyItNowPrice", function (listing) {
        // see notes for endingPrice
        if (listing.listingInfo.convertedBuyItNowPrice) {
            return getKeyValue(listing.listingInfo.convertedBuyItNowPrice)[1];
        }
        return null;
    });
    addField("gift", function (listing) {
        return listing.listingInfo.gift;
    });
    addField("globalId", function (listing) {
        return listing.globalId;
    });
    addField("requestedGlobalId", function (listing) {
        return listing.requestedGlobalId;
    });
    addField("bidCount", function (listing) {
        return listing.sellingStatus.bidCount;
    });
    addField("endingPriceCurrency", function (listing) {
        return getKeyValue(listing.sellingStatus.convertedCurrentPrice)[0];
    });
    addField("endingPrice", function (listing) {
        // the field is called convertedCurrentPrice; however, as the listings
        // have all been finished, this is the ending price for the listing.
        // Also, the converted current price currency depends on the eBay site 
        // that we polled
        return getKeyValue(listing.sellingStatus.convertedCurrentPrice)[1];
    });
    addField("productId", function (listing) {
        var productObj = listing.productId;
        if (productObj) {
            return getKeyValue(listing.productId).join(":");
        }
        return null;
    });
    addField("numPaymentMethods", function (listing) {
        // The payment method could be an Array or a String, so this is a
        // quick workaround to find the number of elements there.
        if (listing.paymentMethods) {
            return [].concat[listing.paymentMethods].length;
        }
        return 0;
    });
    addField("topRatedListing", function (listing) {
        return listing.topRatedListing;
    });
    addField("expeditedShipping", function (listing) {
        if (listing.expeditedShipping) {
            return true;
        }
        return false;
    });
    addField("isMultiVariationListing", function (listing) {
        return listing.isMultiVariationListing;
    });
    addField("autoPay", function (listing) {
        return listing.autoPay;
    });
    addField("charityId", function (listing) {
        return listing.charityId;
    });
    addField("itemURL", function (listing) {
        return listing.viewItemURL;
    });
    // More info about discountPriceInfo field here:
    // http://developer.ebay.com/DevZone/XML/docs/WebHelp/wwhelp/wwhimpl/js/html/wwhelp.htm?context=eBay_XML_API&topic=DiscountPricing
    addField("discount:originalRetailPriceCurrency", function (listing) {
        if (listing.discountPriceInfo) {
            return getKeyValue(listing.discountPriceInfo.originalRetailPrice)[0];
        }
        return null;
    });
    addField("discount:originalRetailPrice", function (listing) {
        if (listing.discountPriceInfo) {
            return getKeyValue(listing.discountPriceInfo.originalRetailPrice)[1];
        }
        return null;
    });
    addField("discount:pricingTreatment", function (listing) {
        if (listing.discountPriceInfo) {
            return listing.discountPriceInfo.pricingTreatment;
        }
        return null;
    });
    addField("discount:soldOnEbay", function (listing) {
        if (listing.discountPriceInfo) {
            return listing.discountPriceInfo.soldOnEbay;
        }
        return null;
    });
    addField("discount:soldOffEbay", function (listing) {
        if (listing.discountPriceInfo) {
            return listing.discountPriceInfo.soldOffEbay;
        }
        return null;
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
                logger.info("No more objects to inspect in the database");
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
            } else if (acceptListing(listing)) {
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