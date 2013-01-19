var http = require("http"),
    https = require("https"),
    fs = require("fs"),
    siri = require("./siri"),

    pingImg = new Buffer("R0lGODlhAQABAJH/AP///wAAAMDAwAAAACH5BAEAAAIALAAAAAABAAEAAAICVAEAOw==", "base64"),
    httpsServer = null,
    siriServer = null;

function haltConfirm(device) {
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
}

function pong(res) {
    res.setHeader("Connection", "close")
    res.setHeader("Content-Type", "image/gif");
    res.end(pingImg);
}

function startHttpsServer(callback) {
    if (siriServer) {
        console.log("Closing Siri Server...");
        siriServer.close(function() {
            siriServer = null;
            startHttpsServer(callback);
            console.log("Siri Server closed.");
        });
        return;
    }

    if (!httpsServer) {
        httpsServer = https.createServer({
            key: fs.readFileSync(__dirname + '/server-key.pem'),
            cert: fs.readFileSync(__dirname + '/server-cert.pem')
        }, function(req, res) {
            pong(res);
        });
        console.log("Starting HTTPS Server...");
        httpsServer.listen(443, callback);
    } else {
        callback();
    }
}

function startSiriServer(callback) {
    if (httpsServer) {
        console.log("Closing HTTPS Server...");
        httpsServer.close(function() {
            httpsServer = null;
            startSiriServer(callback);
            console.log("HTTPS Server closed.");
        });
        return;
    }

    if (!siriServer) {
        siriServer = siri.createServer(function(command, device) {
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
        });
        console.log("Starting Siri Server...");
        siriServer.listen(443, callback);
    } else {
        callback();
    }
}

console.log("Starting HTTP Server...");
http.createServer(function(req, res) {
    if (/^\/welcome(\?.*)?$/.test(req.url)) {
        res.setHeader("Content-Type", "text/html");
        res.end(fs.readFileSync(__dirname + "/welcome.html"));
    } else if (/^\/ping.gif(\?.*)?$/.test(req.url)) {
        pong(res);
    } else if (/^\/https.gif(\?.*)?$/.test(req.url)) {
        startHttpsServer(function() {
            console.log("HTTPS Server start.");
            pong(res);
        });
    } else if (/^\/siri.gif(\?.*)?$/.test(req.url)) {
        startSiriServer(function() {
            console.log("Siri Server start.");
            pong(res);
        });
    } else if (/^\/ca(\?.*)?$/.test(req.url)) {
        res.setHeader("Content-Type", "application/x-x509-ca-cert");
        res.end(fs.readFileSync(__dirname + "/server-cert.pem"));
    } else {
        res.writeHead(301, {
            "Location": "/welcome"
        });
        res.end("301 Moved Permanently");
    }
}).listen(80, function() {
    console.log("HTTP Server start.");
});

startSiriServer(function() {
    console.log("Siri Server start.");
});
