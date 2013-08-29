var siri = require("../../siri");

siri.createServer(function(cmd, dev) {
    if (/你好/.test(cmd)) {
        dev.end("Siri代理向你问好.");
    } else {
        dev.proxy();
    }
}).start();
