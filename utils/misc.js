/*jslint node:true*/
"use strict";

var fs = require("fs");
var timezoneJS = require('timezone-js');
var tz = timezoneJS.timezone;

tz.transport = function (opts) {
    return fs.readFileSync(opts.url, 'utf8');
};
tz.loadingScheme = tz.loadingSchemes.MANUAL_LOAD;
tz.loadZoneJSONData('tz.json', true);

var todayInPST = function () {
    var now = new timezoneJS.Date('US/Pacific'),
        today = new timezoneJS.Date(now.getYear(), now.getMonth(), now.getDate(),
            'US/Pacific');
    return today.toISOString();
};

module.exports.todayInPST = todayInPST;