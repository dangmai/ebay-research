/*jslint node:true*/
/*global describe, it*/
"use strict";

var expect = require("chai").expect;
var db = require("../utils/db");
var config = require("config");

describe("getTopParentCategory", function () {
    it("should get the correct top parent category", function (done) {
        this.timeout(0);
        db.getTopParentCategory("EBAY-GB", 171491)
            .then(function (parentCategoryId) {
                expect(parentCategoryId).to.be.greaterThan(0);
                done();
            }, done);
    });
});

describe.only("cursor", function () {
    it("should get all the documents as specified by cursor count()", function (done) {
        this.timeout(0);
        var cursor = db.getListingCursor(),
            counter = 0;
        db.cursorCount(cursor)
            .then(function (count) {
                cursor.each(function (err, listing) {
                    if (err) {
                        done(err);
                    }
                    if (listing !== null) {
                        counter = counter + 1;
                    } else {
                        expect(counter).to.equal(count);
                        done();
                    }
                });
            }, done);
    });
});