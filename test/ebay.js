/*jslint node:true*/
/*global describe, it*/
"use strict";

var expect = require("chai").expect;
var ebay = require("../utils/ebay");
var misc = require("../utils/misc");
var config = require("config");

describe("findCompletedItems", function () {
    it("should get the completed items from the correct site", function (done) {
        var globalId = "EBAY-SG";
        ebay.findCompletedItems(
            config.ebay.app_id,
            globalId,
            9800,
            misc.randomTimeObservation(config.ebay.history).toISOString()
        ).then(function (listings) {
            var sameSite = 0; // how many listings have the same GlobalId as the one requested
            listings.forEach(function (listing) {
                if (listing.globalId === globalId) {
                    sameSite = sameSite + 1;
                }
            });
            expect(sameSite).to.be.greaterThan(0);
            done();
        }, function (err) {
            done(err);
        });
    });
});