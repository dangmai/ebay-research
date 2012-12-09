/*jslint node:true, nomen:true */
"use strict";

var logger = require("winston");
var optimist = require("optimist");
var config = require('config');
var db = require("./utils/db");
var misc = require("./utils/misc");

var startWebUI = function () {
    var kue = require("kue");
    kue.redis.createClient = misc.createRedisClient;
    kue.app.listen(3000);
};

var startScheduler = function () {
    var scheduler = require("./scheduler");
    logger.info("Scheduler started");
    startWebUI();
    scheduler.schedule()
        .then(function () {
            logger.info("Finished scheduling!");
            scheduler.done();
        }).done();
};

var startWorker = function () {
    var worker = require("./worker");
    logger.info("Worker started");
    worker.process();
};

var startExporting = function () {
    var exporter = require("./exporter");
    logger.info("Start analyzing and exporting data");
    exporter.exportToCsv()
        .then(function () {
            logger.info("Analyzing and exporting done");
            process.exit();
        })
        .fail(function (err) {
            logger.error(err.stack);
            process.exit(1);
        });
};

if (require.main === module) {  // called from CLI
    var argv = optimist  // CLI options
        .usage("Scrape eBay.\nUsage: $0")
        .boolean("scheduler")
        .boolean("worker")
        .boolean("webui")
        .boolean("exporter")
        .describe("scheduler", "Start the scheduler and the WebUI interface")
        .describe("worker", "Start the worker")
        .describe("webui", "Start the WebUI only")
        .describe("exporter", "Build the CSV file from the scraped data")
        .argv;
    // Setting up stuffs that are shared between scheduler and worker
    // logger.add(logger.transports.File, { filename: 'log.txt' });
    logger.remove(logger.transports.Console);
    logger.add(logger.transports.Console, {
        level: config.general.log_level,
        colorize: true
    });

    // Running the required component(s)
    if (argv.scheduler) {
        startScheduler();
    } else if (argv.worker) {
        startWorker();
    } else if (argv.webui) {
        startWebUI();
    } else if (argv.exporter) {
        startExporting();
    } else {
        optimist.showHelp();
        process.exit();
    }
}
