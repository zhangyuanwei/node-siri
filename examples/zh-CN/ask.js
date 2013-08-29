var siri = require("../../siri");

siri.createServer(function(cmd, dev) {
    if (/(关机)|(关(闭)?电脑)/.test(cmd)) {
        dev.ask("确认关机？", function(answer) {
            if (/(确认)|(是)/.test(answer)) {
                dev.end("正在关机...");
                require('child_process').exec("halt");
            } else {
                dev.end("好的，取消了。");
            }
        });
    } else {
        dev.proxy();
    }
}).start();
