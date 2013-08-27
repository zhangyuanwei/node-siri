var siri = require("../siri");

siri.createServer(function(cmd, dev) {
    console.log(cmd);
    dev.proxy();
}).start();
