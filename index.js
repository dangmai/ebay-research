/*jslint node:true, nomen:true */
"use strict";

var logger = require("winston");
var optimist = require("optimist");
var scheduler = require("./scheduler");
// var worker = require("./worker");
var config = require('config');
var db = require("./utils/db");

var startScheduler = function () {
    logger.info("Scheduler started");
    // db.getLocalCategories("EBAY-ENCA")
    scheduler.schedule()
        .then(function (categories) {
            logger.info("Finished scheduling!");
            // db.close();
            scheduler.done();
            process.exit();
        }).done();
};

var startWorker = function () {
    logger.info("Worker started");
};


if (require.main === module) {  // called from CLI
    var argv = optimist  // CLI options
        .usage("Scrape eBay.\nUsage: $0")
        .boolean("scheduler")
        .boolean("worker")
        .describe("scheduler", "Start the scheduler")
        .describe("worker", "Start the worker")
        .argv;
    // Setting up stuffs that are shared between scheduler and worker
    logger.add(logger.transports.File, { filename: 'log.txt' });
    logger.remove(logger.transports.Console);
    logger.add(logger.transports.Console, { colorize: true });

    // Running the required component(s)
    if (argv.scheduler) {
        startScheduler();
    } else if (argv.worker) {
        startWorker();
    } else {
        optimist.showHelp();
    }
}
