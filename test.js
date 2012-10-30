/*jslint node:true*/
/*global describe, it*/
"use strict";

var expect = require("chai").expect,
    er = require("./index.js");

describe("Utils", function () {
    describe("splitProductId", function () {
        it("should split EPID correctly", function () {
            var pid = er.splitProductId("EPID109087904");
            expect(pid.type).to.equal("ReferenceID");
            expect(pid.value).to.equal("109087904");
        });
        it("should throw error if productId is invalid", function () {
            expect(function () { er.splitProductId("Tada"); }).to.throws(/invalid/);
        });
    });
});

describe("Core", function () {
    describe("getCompletedItemsByProductId", function () {
        it("should run without problem", function (done) {
            var promise = er.getCompletedItemsByProductId("EPID109087904");
            this.timeout(10000); // Make sure that eBay has enough time to return data
            promise.then(function (items) {
                done();
            }, function (error) {
                throw "test failed";
                done();
            });
        });
    });
});