"use strict";

var siri = require("../../siri"),
    readline = require("readline");


var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

siri.createServer(function(cmd, dev) {
    rl.question("“" + cmd + "”\n", function(answer) {
        dev.end(answer);
    });
}).start();
