var http = require("http"),
    fs = require("fs");

http.createServer(function(req, res) {
    if (/^\/(\?.*)?$/.test(req.url)) {
        res.setHeader("Content-Type", "text/html");
        res.end(fs.readFileSync("./index.html"));
    } else if (/^\/ca.pem(\?.*)?$/.test(req.url)) {
        res.setHeader("Content-Type", "application/x-x509-ca-cert");
        res.end(fs.readFileSync("./server-cert.pem"));
    } else {
        res.writeHead(301, {
            "Location": "/"
        });
        res.end("301 Moved Permanently");
    }
}).listen(8080);
