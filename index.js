/*jslint node:true */
"use strict";

var ER = {};
var self = ER;
var ebay = require('ebay-api');
var logger = require("winston");
var Q = require("q");
var appId = 'DangMai64-2cef-4d50-966a-c36771e682e';

/**
 * Split a productId into 2 parts: the type and the value.
 * @param productId the productId to split.
 * @return an object that contains the type and value for the input productId.
 */
ER.splitProductId = function (productId) {
    var productIdTypeMap = {
        "EPID": "ReferenceID",
        "ISBN": "ISBN",
        "UPC": "UPC",
        "EAN": "EAN"
    },
        pid = {};
    Object.keys(productIdTypeMap).forEach(function (key) {
        if (productId.indexOf(key) === 0) {
            pid.type = productIdTypeMap[key];
            pid.value = productId.slice(key.length);
        }
    });
    if (!pid.value) {
        logger.warn("productId seems to be invalid");
        throw "Invalid productId";
    }
    return pid;
};

/**
 * Get all completed items (that eBay provides) by productId.
 * @param productId the product id to search for.
 * @return a promise for all the completed items.
 */
ER.getCompletedItemsByProductId = function (productId) {
    var pid = self.splitProductId(productId),
        deferred = Q.defer();
    ebay.ebayApiGetRequest({
        'serviceName': 'FindingService',
        'opType': 'findCompletedItems',
        'appId': appId,

        params: {
            "productId.@type": pid.type,
            "productId": pid.value,
            outputSelector: ["SellerInfo", "StoreInfo"]
        }
    }, function (error, data) {
        logger.info("eBay request finished");
        if (error) {
            logger.error(error);
            deferred.reject(new Error(error));
        } else {
            logger.debug(JSON.stringify(data, null, 2));
            deferred.resolve(data);
        }
    });
    return deferred.promise;
};

module.exports = ER;