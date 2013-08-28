var siri = require("../siri");

siri.createServer(function(cmd, dev) {
    if (/(Shutdown)|(Turn computer off)/.test(cmd)) {
        dev.ask("Confirm shutdown?", function(answer) {
            if (/(Confirm)|(Yes)/.test(answer)) {
                dev.end("Shutting down...");
                require('child_process').exec("halt");
            } else {
                dev.end("Shutdown cancelled.");
            }
        });
    } else {
        dev.proxy();
    }
}).start();
