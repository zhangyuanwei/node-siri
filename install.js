'use strict';

var http = require("http"),
    https = require("https"),
    fs = require("fs"),
    siri = require("./siri"),

    pingImg = new Buffer("R0lGODlhAQABAJH/AP///wAAAMDAwAAAACH5BAEAAAIALAAAAAABAAEAAAICVAEAOw==", "base64"),
    httpsServer = null,
    siriServer = null,
    clients = [];

function haltConfirm(device) { //{{{
    device.ask("你真的想要我帮你关机吗?(确认/取消)", "你真的想要我帮你关机吗?", function(answer) {
        if (answer == "确认") {
            device.say("好的，3秒后关机...");
            setTimeout(function() {
                device.say("3");
                setTimeout(function() {
                    device.say("2");
                    setTimeout(function() {
                        device.say("1");
                        setTimeout(function() {
                            device.end("正在关机...");
                            require('child_process').exec("halt");
                        }, 1000);
                    }, 1000);
                }, 1000);
            }, 2000);
        } else if (answer == "取消") {
            device.end("好的，自己的事情自己做!");
        } else {
            device.say("我听不大懂“" + answer + "”.", "我听不大懂.");
            haltConfirm(device);
        }
    });
} // }}}

function commandHandle(command, device) { //{{{
    if (command == "关机") {
        haltConfirm(device);
    } else if (command == "你好") {
        device.say("Siri代理向你问好.");
        device.say("我现在能干的事情有:");
        device.say("1.关机");
        device.end("没了^_^");
    } else {
        device.proxy();
    }
} // }}}

function pong(res) { // {{{
    res.setHeader("Connection", "close")
    res.setHeader("Content-Type", "image/gif");
    res.end(pingImg);
} // }}}

function destroySockets() { // {{{
    while ((function(socket) {
        socket && socket.destroy();
        return !!socket;
    })(clients.pop()));
} // }}}

function startHttpsServer(callback) { // {{{
    if (!httpsServer) {
        stopSiriServer(function() {
            httpsServer = https.createServer({
                key: fs.readFileSync(__dirname + '/keys/server-key.pem'),
                cert: fs.readFileSync(__dirname + '/keys/server-cert.pem')
            }, function(req, res) {
                pong(res);
            });
            httpsServer.on("connection", function(socket) {
                clients.push(socket);
            });
            console.log("Starting HTTPS server...");
            httpsServer.listen(443, function() {
                console.log("HTTPS server started.");
                callback();
            });
        });
    } else {
        callback();
    }
} // }}}

function stopHttpsServer(callback) { // {{{
    if (httpsServer) {
        console.log("Stopping HTTPS server...");
        destroySockets();
        httpsServer.close(function() {
            httpsServer = null;
            console.log("HTTPS server stopped.");
            callback();
        });
    } else {
        callback();
    }
} // }}}

function startSiriServer(callback) { // {{{
    if (!siriServer) {
        stopHttpsServer(function() {
            siriServer = siri.createServer(commandHandle);
            siriServer.on("connection", function(socket) {
                clients.push(socket);
            });
            console.log("Starting siri server...");
            siriServer.start(function() {
                console.log("Siri server started.");
                callback();
            });
            /*
            siriServer.listen(443, function() {
                console.log("Siri server started.");
                callback();
            });
			*/
        });
    } else {
        callback();
    }
} // }}}

function stopSiriServer(callback) { // {{{
    if (siriServer) {
        console.log("Stopping siri server...");
        destroySockets();
        siriServer.close(function() {
            siriServer = null;
            console.log("Siri server stopped.");
            callback();
        });
    } else {
        callback();
    }
} // }}}

startSiriServer(function() { // {{{
    console.log("Starting HTTP Server...");
    http.createServer(function(req, res) {
        if (/^\/welcome(\?.*)?$/.test(req.url)) {
            res.setHeader("Content-Type", "text/html");
            res.end(fs.readFileSync(__dirname + "/welcome.html"));
        } else if (/^\/ping.gif(\?.*)?$/.test(req.url)) {
            pong(res);
        } else if (/^\/https.gif(\?.*)?$/.test(req.url)) {
            startHttpsServer(function() {
                pong(res);
            });
        } else if (/^\/siri.gif(\?.*)?$/.test(req.url)) {
            startSiriServer(function() {
                pong(res);
            });
        } else if (/^\/ca(\?.*)?$/.test(req.url)) {
            res.setHeader("Content-Type", "application/x-x509-ca-cert");
            res.end(fs.readFileSync(__dirname + "/keys/server-cert.pem"));
        } else {
            res.writeHead(301, {
                "Location": "/welcome"
            });
            res.end("301 Moved Permanently");
        }
    }).listen(80, function() {
        console.log("HTTP Server started.");
    });
}); // }}}

// vim600: sw=4 ts=4 fdm=marker syn=javascript
