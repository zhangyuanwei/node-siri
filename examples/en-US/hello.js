var siri = require("../../siri");

siri.createServer(function(cmd, dev) {
    if (/Hello/.test(cmd)) {
        dev.end("Siri Proxy says Hello!");
    } else {
        dev.proxy();
    }
}).start();
