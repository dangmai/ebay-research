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

describe("getCategoryName", function () {
    it("should get the correct category name", function (done) {
        this.timeout(0);
        db.getCategoryName("EBAY-SG", "20081")
            .then(function (name) {
                expect(name).to.equal("Antiques");
                done();
            }, done);
    });
});

describe("cursor", function () {
    it("should get all the documents as specified by cursor count()", function (done) {
        this.timeout(0);
        var cursor = db.getListingCursor(),
            counter = 0;
        db.cursorCount(cursor)
            .then(function (count) {
                console.log("Cursor count: " + count);
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

describe("listing", function () {
    it("should upsert/get/remove listing correctly", function (done) {
        this.timeout(0);
        var id = "1616456464646";
        db.insertListing({ itemId: id, value: "old" })
            .then(function () {
                return db.getListing(id);
            })
            .then(function (listing) {
                expect(listing.value).to.equal("old");
                return db.insertListing({ itemId: id, value: "new" });
            })
            .then(function () {
                return db.getListing(id);
            })
            .then(function (listing) {
                expect(listing.value).to.equal("new");
                return db.removeListing(id);
            })
            .then(function () {
                return db.getListing(id);
            })
            .then(function (listing) {
                expect(listing).to.be.null;
                done();
            })
            .fail(done);
    });
});