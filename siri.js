var tls = require('tls'),
    util = require('util'),
    zlib = require('zlib'),
    fs = require('fs'),
    Stream = require('stream'),

    parser = require("./parser"),
    bplist = require("./bplist"),
    SiriParser = parser.SiriParser,

    SIRI_SERVER = "17.151.230.4",
    //SIRI_SERVER = "17.174.8.5",
    SIRI_PORT = 443,
    SIRI_DEBUG = false;

function toArray(list) {
    return [].slice.call(list, 0);
}

function debug() {
    if (SIRI_DEBUG) return console.log.apply(console, toArray(arguments));
}

var id = 0;

function getId() {
    id++;
    return (id < 100 ? "0" : "") + (id < 10 ? "0" : "") + id;
}

function Server(options, commandListener) { // Server {{{
    if (!(this instanceof Server)) return new Server(options, commandListener);
    tls.Server.call(this, options);

    this.deviceMap = {};

    if (commandListener) {
        this.on("command", commandListener);
    }

    this.on("secureConnection", secureConnectionListener);
    this.on("clientError", function(err) {
        debug(err);
    });
}

util.inherits(Server, tls.Server);

Server.prototype.getDevice = function(key) {
    return this.deviceMap[key] = (this.deviceMap[key] || new SiriDevice());
};

Server.prototype.start = function(callback) {
    return this.listen(SIRI_PORT, callback);
};

exports.Server = Server;
exports.createServer = function(options, listener) {
    if (typeof options === "function") {
        listener = options;
        options = undefined;
    }

    options = options || {
        key: fs.readFileSync(__dirname + '/server-key.pem'),
        cert: fs.readFileSync(__dirname + '/server-cert.pem')
    };

    return new Server(options, listener);
}

function secureConnectionListener(clientStream) {
    var self = this,
        clientParser = new SiriParser(parser.SIRI_REQUEST),
        clientCompressor = null,

        serverStream = tls.connect(SIRI_PORT, SIRI_SERVER),
        serverParser = new SiriParser(parser.SIRI_RESPONSE),
        serverCompressor = null,
        device = null;

    clientStream.pipe(serverStream);
    //解析请求得到设备
    clientStream.ondata = function(data, start, end) {
        clientParser.parse(data, start, end);
    };
    //clientStream.on("end", clientStream.onend = function() {
    //    debug("ClientStream end");
    //});
    //clientStream.on("close", function() {
    //    debug("ClientStream close");
    //});
    clientParser.onAccept = function(pkg) {
        switch (pkg.getType()) {
            case parser.PKG_HTTP_HEADER:
                device = self.getDevice(pkg.headers["X-Ace-Host"]);
                device.onCommand = function(str) {
                    self.emit("command", str, device);
                };
                break;
            case parser.PKG_HTTP_ACEHEADER:
                //模拟客户端和服务器通讯的压缩器
                clientCompressor = zlib.createDeflate();
                clientCompressor._flush = zlib.Z_SYNC_FLUSH;
                clientCompressor.pipe(serverStream);
                device.setUpstream(clientCompressor);

                //模拟服务器和客户端通讯的压缩器
                serverCompressor = zlib.createDeflate();
                serverCompressor._flush = zlib.Z_SYNC_FLUSH;
                serverCompressor.pipe(clientStream);
                device.pipe(serverCompressor);
                break;
            case parser.PKG_ACE_PLIST:
                if (SIRI_DEBUG) {
                    fs.writeFileSync("data/" + getId() + ".client.json", pkg.rootNode().stringify());
                }
                break;
            case parser.PKG_HTTP_UNKNOW:
            case parser.PKG_ACE_UNKNOW:
                break;
            default:
                self.emit("error", "Unknow package type:" + pkg.type + "!");
                break;
        }
    };

    //截获服务器信息
    serverStream.ondata = function(data, start, end) {
        serverParser.parse(data, start, end);
    };
    //serverStream.on("end", serverStream.onend = function() {
    //    debug("ServerStream end");
    //});
    //serverStream.on("close", function() {
    //    debug("ServerStream close");
    //});

    serverParser.onAccept = function(pkg) {
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
                if (SIRI_DEBUG) {
                    fs.writeFileSync("data/" + getId() + ".server.json", pkg.rootNode().stringify());
                }
                device.receivePackage(pkg);
                break;
            default:
                self.emit("error", "Unknow package type:" + pkg.type + "!");
                break;
        }
    };

    debug("Client connect.");
}
// }}}

function SiriDevice() { // Device {{{
    Stream.call(this);

    this.writable = false;
    this.readable = true;

    this.upstream = null;
    this.serverResponse = [];
    this.viewList = [];
    this.saying = false;
    this.proxied = true;
    this.asking = false;

    this.aceId = null;
    this.refId = null;
    this.version = null;
}

util.inherits(SiriDevice, Stream);

function getRecognizedText(obj) {
    var arr;
    if (obj["class"] != "SpeechRecognized") return null;
    arr = [];
    obj.properties.recognition.properties.phrases.forEach(function(item) {
        item.properties.interpretations[0].properties.tokens.forEach(function(item) {
            arr.push(item.properties.text);
        });
    });
    return arr.join("");
}

SiriDevice.prototype.onCommand = function() {
    //Do nothing
};

SiriDevice.prototype.onAnswer = function() {
    //Do nothing
};

SiriDevice.prototype.setUpstream = function(upstream) {
    this.upstream = upstream;
};

SiriDevice.prototype.receivePackage = function(pkg) {
    var obj = pkg.rootNode().toObject();

    this.refId = obj.refId;
    this.aceId = obj.aceId;
    this.version = obj.v;

    debug(obj["class"]);
    switch (obj["class"]) {
        case "SpeechRecognized":
            this.serverResponse = [];
            this.proxied = false;

            this.writeClient(pkg);
            if (this.asking) {
                this.asking = false;
                this.onAnswer(getRecognizedText(obj));
            } else {
                this.onCommand(getRecognizedText(obj));
            }
            break;
        default:
            if (this.proxied) {
                this.writeClient(pkg);
            } else {
                this.serverResponse.push(pkg);
            }
            break;
    }
};

SiriDevice.prototype.getUtteranceView = function(str, speakable, listen) {
    return {
        "class": "string:AssistantUtteranceView",
        "properties": {
            //"dialogIdentifier": "string:Misc#answer",
            "speakableText": "unicode:" + (speakable === undefined ? str : speakable),
            "text": "unicode:" + str,
            "listenAfterSpeaking": "null:" + (listen ? "true" : "false")
        },
        "group": "string:com.apple.ace.assistant"
    };
};

SiriDevice.prototype.addView = function(view) {
    var self = this;
    this.viewList.push(view);
    if (!this.saying) {
        this.saying = true;
        process.nextTick(function() {
            if (self.saying) {
                self.saying = false;
                self.flushViews();
            }
        });
    }
};

SiriDevice.prototype.flushViews = function() {
    this.writeClient(new parser.ACEBinaryPlist(bplist.fromPObject({
        "class": "string:AddViews",
        "properties": {
            "temporary": "null:false",
            //"dialogPhase": "string:Completion",
            "scrollToTop": "null:false",
            "views": this.viewList,
        },
        "v": "string:" + this.version,
        "refId": "string:" + this.refId,
        "aceId": "string:" + this.aceId,
        "group": "string:com.apple.ace.assistant"
    })));
    this.viewList = [];
};

SiriDevice.prototype.requestCompleted = function() {
    this.writeClient(new parser.ACEBinaryPlist(bplist.fromPObject({
        "class": "string:RequestCompleted",
        "properties": {
            "callbacks": []
        },
        "v": "string:" + this.version,
        "refId": "string:" + this.refId,
        "aceId": "string:" + this.aceId,
        "group": "string:com.apple.ace.system"
    })));
};

SiriDevice.prototype.writeServer = function(pkg) {
    this.upstream.write(pkg.getData());
};

SiriDevice.prototype.writeClient = function(pkg) {
    this.emit('data', pkg.getData());
};

SiriDevice.prototype.proxy = function() {
    var self = this;
    this.serverResponse.forEach(function(pkg, index) {
        self.writeClient(pkg);
    });
    this.proxied = true;
};

SiriDevice.prototype.say = function(str, speakable) {
    this.addView(this.getUtteranceView(str, speakable, false));
};

SiriDevice.prototype.ask = function(str, speakable, callback) {
    if (typeof(speakable) != "string") {
        callback = speakable;
        speakable = undefined;
    }
    this.asking = true;
    this.onAnswer = callback;
    this.addView(this.getUtteranceView(str, speakable, true));
};

SiriDevice.prototype.end = function(str, speakable) {
    if (str !== undefined) this.say(str, speakable);
    this.saying = false;
    this.flushViews();
    this.requestCompleted();
};
// }}}
// vim600: sw=4 ts=4 fdm=marker syn=javascript
