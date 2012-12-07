/*jslint node:true*/
module.exports = {
    Mongo: {
        address: "localhost:27017/ebay?auto_reconnect"
    },
    Redis: {
        host: "localhost",
        port: 6379,
        password: ""
    },
    ebay: {
        app_id: "",
        user_token: "",
        countries: [
            "EBAY-US",
            "EBAY-GB",
            "EBAY-SG"
        ],
        history: 7,  // how far back to look for data (in days)
        requestsPerDay: 4900
    }
};
