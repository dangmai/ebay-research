My eBay Research Project
========================

My attempt at researching eBay historical data (for my Econometrics class). This
project is written using [NodeJS](http://nodejs.org/), uses
[MongoDB](http://www.mongodb.org/) for persistence and [Redis](http://redis.io/)
for distributed computations; so you need to have all of those set up before
hand. There are a lot of stuff going on here, so your best bet is simply to
`node index.js` and follow the instruction from there (and read the code!).

Basically, the project uses a distributed computation pattern in order to
parallelize the workload. Running `node index.js --scheduler` will schedule the
workload (in this case, it schedules a bunch of requests to the eBay API, in
order to pull down the historical pricing from different categories for various
eBay localized sites, all of which are configurable via the config file) and
starts the WebUI that you can access via port 3000.

The `--worker` flag will run one worker, in order to execute the scheduled task.
I use [supervisord](http://supervisord.org/) to start up 8 workers in parallel,
so that the whole process takes shorter perdiod of time.

The `--webui` flag only runs the webui without scheduling (this webui, as well
as the task distribution system, is provided by the excellent
[Kue](http://learnboost.github.com/kue/) library).

Last but not least, `--exporter` exports the data that were gathered by the
workers into a CSV file (which I further process using Stata for Econometrics
purposes).

The options for this program can be configured in `config/default.js` (the options are loaded using the [config](https://github.com/lorenwest/node-config.git) library, so you can use any loading strategy you want).

eBay specific notes
-------------------

In order to use this library, you need to have an [eBay Developer](https://www.x.com/developers/ebay) account. This library mainly uses the [findCompletedItems](http://developer.ebay.com/DevZone/finding/CallRef/findCompletedItems.html) API call, which is limited to 5000 requests/day, so you'll have to plan your usage accordingly. Furthermore, I am not responsible for your usage of the eBay API (in particular, persisting what you get from the eBay - please make sure that you understand and accept the eBay API Terms and Conditions).
