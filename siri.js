var tls = require('tls'),
    util = require('util'),
    zlib = require('zlib'),

    parser = require("./parser"),
    bplist = require("./bplist"),
    SiriParser = parser.SiriParser,

    SIRI_SERVER = "17.151.230.4",
    //SIRI_SERVER = "17.174.8.5",
    SIRI_PORT = 443;

function Server(options, commandListener) { // Server {{{
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
    var proxyServer = this,
        clientParser = new SiriParser(parser.SIRI_REQUEST),
        //clientCompressor = zlib.createDeflate(),

        serverStream = tls.connect(SIRI_PORT, SIRI_SERVER),
        serverParser = new SiriParser(parser.SIRI_RESPONSE),
        serverCompressor = zlib.createDeflate(),
        STATE_WAIT_SPEECH_RECOGNIZE = 0,
        STATE_WAIT_REQUEST_COMPLETE = 1,
        state = STATE_WAIT_SPEECH_RECOGNIZE,
        prevent = false;

    clientStream.pipe(serverStream);
    //只解析请求，不做修改
    //clientCompressor._flush = zlib.Z_SYNC_FLUSH;
    //clientCompressor.pipe(serverStream);
    clientStream.ondata = function(data, start, end) {
        clientParser.parse(data, start, end);
    };
    clientParser.on("package", function(pkg) {
        switch (pkg.getType()) {
            case parser.PKG_HTTP_HEADER:
            case parser.PKG_HTTP_ACEHEADER:
            case parser.PKG_HTTP_UNKNOW:
            case parser.PKG_ACE_UNKNOW:
                break;
            case parser.PKG_ACE_PLIST:
                fs.writeFileSync("data/" + getId() + ".client.json", pkg.rootNode().stringify());
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
        var node, obj, arr, res;
        switch (pkg.getType()) {
            case parser.PKG_HTTP_HEADER:
            case parser.PKG_HTTP_ACEHEADER:
            case parser.PKG_HTTP_UNKNOW:
                clientStream.write(pkg.getData());
                break;
            case parser.PKG_ACE_UNKNOW:
                serverCompressor.write(pkg.getData());
                break;
            case parser.PKG_ACE_PLIST:

                node = pkg.rootNode();
                obj = node.toObject();

                switch (state) {
                    case STATE_WAIT_SPEECH_RECOGNIZE:
                        if (obj["class"] == "SpeechRecognized") {
                            arr = [];
                            obj.properties.recognition.properties.phrases.forEach(function(item) {
                                item.properties.interpretations[0].properties.tokens.forEach(function(item) {
                                    arr.push(item.properties.text);
                                });
                            });
                            res = new SiriResponse(pkg);
                            proxyServer.emit("command", arr.join(""), res);
                            res.response.forEach(function(node) {
                                var pkg = new parser.ACEBinaryPlist(node);
                                serverCompressor.write(pkg.getData());
                            });
                            prevent = res.prevent;
                            state = STATE_WAIT_REQUEST_COMPLETE;
                        }
                        break;
                    case STATE_WAIT_REQUEST_COMPLETE:
                        if (obj["class"] == "RequestCompleted") {
                            state = STATE_WAIT_SPEECH_RECOGNIZE;
                        }
                }
                if (!prevent) {
                    serverCompressor.write(pkg.getData());
                }
                fs.writeFileSync("data/" + getId() + ".server.json", node.stringify());
                break;
            default:
                console.log("Unknow package type:" + pkg.type + "!");
        }
    });

    console.log("Client connect.");
}
// }}}

function SiriResponse(pkg) { // Response {{{
    this.speech = pkg;
    this.prevent = false;
    this.response = [];
}

SiriResponse.prototype.say = function(str) {
    this.prevent = true;
    this.response.push();
};

SiriResponse.prototype.getResponse = function(){

};
// }}}

//Test
var fs = require("fs"),
    siri = exports,
    tmp = 0;

function getId() {
    return (++tmp < 10) ? "0" + tmp : tmp;
}
//*
siri.createServer({
    key: fs.readFileSync('/home/zhangyuanwei/.siriproxy/server.passless.key'),
    cert: fs.readFileSync('/home/zhangyuanwei/.siriproxy/server.passless.crt')
}, function(command, client) {
    console.log(command);
    if (command == "你好") {
        client.say("Siri代理向你问好!");
    }
}).listen(4433, function() {
    console.log("Proxy start.");
});
//*/
// vim600: sw=4 ts=4 fdm=marker syn=javascript
