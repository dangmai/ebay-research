/*jslint node:true*/
"use strict";

var kue = require('kue'),
    cluster = require('cluster'),
    mongo = require('mongoskin'),
    jobs = kue.createQueue(),
    ebay = require("utils/ebay"),
    db = require("utils/db"),
    collection = db.collection('auctions');

var consume = function () {
    jobs.process('findCompletedItems', function (job, done) {
        utils.ebayGet(job.data)
            .then(function (items) {
                items.forEach(function (item) {
                    collection.insert(item);
                });
                done();
            }, function (err) {
                done(err.message);
            });
    });
};

var close = function () {
    db.close();
};

module.exports.consume = consume;
module.exports.close = close;
