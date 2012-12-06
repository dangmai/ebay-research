/*jslint node:true*/
module.exports = {
    Mongo: {
        address: "localhost:27017/ebay?auto_reconnect"
    },
    Redis: {
        address: ""
    },
    ebay: {
        app_id: "",
        user_token: "",
        countries: [
            "EBAY-US",
            //"EBAY-ENCA",
            //"EBAY-HK"
        ]
    }
};
