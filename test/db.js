/*jslint node:true*/
/*global describe, it*/
"use strict";

var expect = require("chai").expect;
var db = require("../utils/db");
var config = require("config");

describe("getTopParentCategory", function () {
    it("should get the correct top parent category", function (done) {
        db.getTopParentCategory("EBAY-GB", 171491)
            .then(function (parentCategoryId) {
                expect(parentCategoryId).to.be.greaterThan(0);
                done();
            }, done);
    });
});