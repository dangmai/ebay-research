/*jslint node:true */
"use strict";

var ebay = require('ebay-api');
var Q = require("q");
var logger = require("winston");
var config = require('config');

var sites = {  // keys are Global ID, values are Site ID; excludes MOTOR
    "EBAY-US": 0,
    "EBAY-AT": 16,
    "EBAY-AU": 15,
    "EBAY-CH": 193,
    "EBAY-DE": 77,
    "EBAY-ENCA": 2,
    "EBAY-ES": 186,
    "EBAY-FR": 71,
    "EBAY-FRBE": 23,
    "EBAY-FRCA": 210,
    "EBAY-GB": 3,
    "EBAY-HK": 201,
    "EBAY-IE": 205,
    "EBAY-IN": 203,
    "EBAY-IT": 101,
    "EBAY-MY": 207,
    "EBAY-NL": 146,
    "EBAY-NLBE": 123,
    "EBAY-PH": 211,
    "EBAY-PL": 212,
    "EBAY-SG": 216
};

/**
 * Helper to execute a get request to eBay's API.
 * @param request the request object used by ebay-api.
 * @return a promise for the value returned by the API.
 */
var get = function (request) {
    var deferred = Q.defer();
    ebay.ebayApiGetRequest(request, function (error, items, meta) {
        logger.info("eBay GET request finished");
        if (error) {
            logger.info("There is an error with the GET request");
            deferred.reject(new Error(error));
        } else {
            logger.info("The GET request is successful");
            logger.debug(meta.paginationOutput);
            deferred.resolve({
                items: items,
                meta: meta
            });
        }
    });
    return deferred.promise;
};

/**
 * Helper to execute a POST request to eBay's API.
 * @param request the request object used by ebay-api.
 * @return a promise for the value returned by the API.
 */
var post = function (request) {
    var deferred = Q.defer();
    logger.info("POST request");
    logger.debug(request);
    ebay.ebayApiPostXmlRequest(request, function (error, data) {
        logger.info("eBay POST request finished");
        if (error) {
            logger.error("There is an error with the POST request");
            deferred.reject(new Error(error));
        } else {
            logger.info("The POST request is successful");
            deferred.resolve(data);
        }
    });
    return deferred.promise;
};

/**
 * Get the category structure of an eBay site.
 * @param String globalId the GlobalID for the eBay site
 * @param Boolean checkVersionOnly only check the category version
 * @returns the whole category structure of the eBay site
 */
var getCategories = function (globalId, checkVersionOnly) {
    if (checkVersionOnly) {
        logger.info("Getting remote categories info for ebay site " + globalId);
    } else {
        logger.info("Getting remote categories structure for ebay site " + globalId);
    }

    var params = {
        'X-EBAY-API-SITEID': sites[globalId],
        authToken: config.ebay.user_token
    };
    if (!checkVersionOnly) {
        params.DetailLevel = "ReturnAll";
    }
    return post({
        'serviceName': 'Trading',
        'opType': 'GetCategories',
        'appName': config.ebay.app_id,

        params: params
    });
};

/**
 * Find eBay completed items.
 */
var findCompletedItems = function (params, filters) {
    return get({
        'serviceName': 'FindingService',
        'opType': 'findCompletedItems',
        'appId': config.ebay.appId,

        params: params,
        filters: filters || []
    });
};

/**
 * Split a productId into 2 parts: the type and the value.
 * @param productId the productId to split.
 * @return an object that contains the type and value for the input productId.
 */
var splitProductId = function (productId) {
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


module.exports.splitProductId = splitProductId;
module.exports.getCategories = getCategories;
module.exports.sites = sites;
