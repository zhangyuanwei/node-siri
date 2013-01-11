var tls = require('tls'),
    util = require('util'),
    zlib = require('zlib'),

    parser = require("./parser"),
    SiriParser = parser.SiriParser,

    SIRI_SERVER = "17.151.230.4",
    SIRI_PORT = 443;

function Server(options, commandListener) {
    if (!(this instanceof Server)) {
        return new Server(options, commandListener);
    }

    tls.Server.call(this, options, secureConnectionListener);

    if (commandListener) {
        this.addListener("command", commandListener);
    }
}

util.inherits(Server, tls.Server);

exports.Server = Server;
exports.createServer = function(options, listener) {
    return new Server(options, listener);
}

function secureConnectionListener(clientStream) {
    var clientParser = new SiriParser(parser.SIRI_REQUEST),
        clientCompressor = zlib.createDeflate(),

        serverStream = tls.connect(SIRI_PORT, SIRI_SERVER),
        serverParser = new SiriParser(parser.SIRI_RESPONSE),
        serverCompressor = zlib.createDeflate();


    clientCompressor._flush = zlib.Z_SYNC_FLUSH;
    clientCompressor.pipe(serverStream);
    clientStream.ondata = function(data, start, end) {
        clientParser.parse(data, start, end);
    };
    clientParser.on("package", function(pkg) {
        switch (pkg.getType()) {
            case parser.PKG_HTTP_HEADER:
            case parser.PKG_HTTP_ACEHEADER:
            case parser.PKG_HTTP_UNKNOW:
                clientStream.write(pkg.getData());
                break;
            case parser.PKG_ACE_UNKNOW:
                clientCompressor.write(pkg.getData());
                break;
            case parser.PKG_ACE_PLIST:
                oldData = pkg.getData();
                newData = new parser.ACEBinaryPlist(pkg.rootNode()).getData();
                clientCompressor.write(newData);
                tmp = (tmp || 0) + 1;
                fs.writeFileSync("data/" + tmp + ".old.dat", oldData);
                fs.writeFileSync("data/" + tmp + ".new.dat", newData);
                break;
            default:
                console.log("Unknow package type:" + pkg.type + "!");
        }
    });

    serverCompressor._flush = zlib.Z_SYNC_FLUSH;
    serverCompressor.pipe(clientStream);
    serverStream.ondata = function(data, start, end) {
        serverParser.parse(data, start, end);
    };
    serverParser.on("package", function(pkg) {
        var oldData, newData;
        switch (pkg.getType()) {
            case parser.PKG_HTTP_HEADER:
            case parser.PKG_HTTP_ACEHEADER:
            case parser.PKG_HTTP_UNKNOW:
                clientStream.write(pkg.getData());
                break;
            case parser.PKG_ACE_UNKNOW:
                clientCompressor.write(pkg.getData());
                break;
            case parser.PKG_ACE_PLIST:
                oldData = pkg.getData();
                newData = new parser.ACEBinaryPlist(pkg.rootNode()).getData();
                clientCompressor.write(newData);
                tmp = (tmp || 0) + 1;
                fs.writeFileSync("data/" + tmp + ".old.dat", oldData);
                fs.writeFileSync("data/" + tmp + ".new.dat", newData);
                break;
            default:
                console.log("Unknow package type:" + pkg.type + "!");
        }
    });

    console.log("Client connect.");
}

//Test
var fs = require("fs"),
    siri = exports,
    tmp;
//*
siri.createServer({
    key: fs.readFileSync('/home/zhangyuanwei/.siriproxy/server.passless.key'),
    cert: fs.readFileSync('/home/zhangyuanwei/.siriproxy/server.passless.crt')
}, function(command, client) {

}).listen(4433, function() {
    console.log("Proxy start.");
});
//*/

/*
var parser = new SiriParser(parser.SIRI_REQUEST);

parser.on("package", function(pkg) {
    console.log(pkg);
});

fs.readFile("data/client.dat", function(err, data) {
    parser.parse(data, 0, data.length);
});
//*/

/*
var parser = new SiriParser(parser.SIRI_RESPONSE);
parser.on("package", function(pkg) {
    console.log(pkg);
});
fs.readFile("data/server.dat", function(err, data) {
    parser.parse(data, 0, data.length);
});
//*/
