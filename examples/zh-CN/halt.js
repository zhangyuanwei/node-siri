var siri = require("../../siri");

siri.createServer(function(cmd, dev) {
    if (/(关机)|(关(闭)?电脑)/.test(cmd)) {
        dev.end("正在关机...");
        require('child_process').exec("halt");
    } else {
        dev.proxy();
    }
}).start();
