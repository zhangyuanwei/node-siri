var http = require("http"),
    https = require("https"),
    fs = require("fs"),
    siri = require("./siri");

var pingImg = new Buffer("R0lGODlhAQABAJH/AP///wAAAMDAwAAAACH5BAEAAAIALAAAAAABAAEAAAICVAEAOw==", "base64"),
    httpsServer = null,
    siriServer = null;

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
            key: fs.readFileSync('./server-key.pem'),
            cert: fs.readFileSync('./server-cert.pem')
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
        siriServer = siri.createServer({
            key: fs.readFileSync('./server-key.pem'),
            cert: fs.readFileSync('./server-cert.pem')
        }, function(command, device) {
            console.log(command);
            if (command == "你好") {
                device.say("3");
                setTimeout(function() {
                    device.say("2");
                    setTimeout(function() {
                        device.say("1");
                        setTimeout(function() {
                            device.end("Siri代理向你问好!");
                        }, 1000);
                    }, 1000);
                }, 1000);
            } else if (command == "关机") {
                device.end("正在关机...");
                require('child_process').exec("sudo halt");
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

http.createServer(function(req, res) {
    if (/^\/welcome(\?.*)?$/.test(req.url)) {
        res.setHeader("Content-Type", "text/html");
        res.end(fs.readFileSync("./welcome.html"));
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
        res.end(fs.readFileSync("./server-cert.pem"));
    } else {
        res.writeHead(301, {
            "Location": "/welcome"
        });
        res.end("301 Moved Permanently");
    }
}).listen(80, function() {
    console.log("HTTP Server start.");
});
console.log("Starting HTTP Server...");
