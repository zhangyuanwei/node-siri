var tls = require('tls'),
    util = require('util'),
    zlib = require('zlib'),
    Stream = require('stream'),

    parser = require("./parser"),
    bplist = require("./bplist"),
    SiriParser = parser.SiriParser,

    SIRI_SERVER = "17.151.230.4",
    //SIRI_SERVER = "17.174.8.5",
    SIRI_PORT = 443;

function Server(options, commandListener) { // Server {{{
    if (!(this instanceof Server)) return new Server(options, commandListener);
    tls.Server.call(this, options);

    if (commandListener) {
        this.on("command", commandListener);
    }

    this.on("secureConnection", secureConnectionListener);
    this.on("clientError", function(err) {
		//console.log(err);
    });
}

util.inherits(Server, tls.Server);

exports.Server = Server;
exports.createServer = function(options, listener) {
    return new Server(options, listener);
}

function secureConnectionListener(clientStream) {
    var self = this,
        clientParser = new SiriParser(parser.SIRI_REQUEST),
        //clientCompressor = zlib.createDeflate(),

        serverStream = tls.connect(SIRI_PORT, SIRI_SERVER),
        serverParser = new SiriParser(parser.SIRI_RESPONSE),
        serverCompressor = zlib.createDeflate(),
        device = new SiriDevice();

    clientStream.pipe(serverStream);
    //只解析请求，不做修改
    //clientCompressor._flush = zlib.Z_SYNC_FLUSH;
    //clientCompressor.pipe(serverStream);
    clientStream.ondata = function(data, start, end) {
        clientParser.parse(data, start, end);
    };
    clientStream.on("end", clientStream.onend = function() {
        //console.log("ClientStream end");
    });
    clientStream.on("close", function() {
        //console.log("ClientStream close");
    });
    clientParser.onAccept = function(pkg) {
        if (pkg.getType() == parser.PKG_ACE_PLIST) {
            //fs.writeFileSync("data/" + getId() + ".client.json", pkg.rootNode().stringify());
        }
    };

    //准备压缩管道
    serverCompressor._flush = zlib.Z_SYNC_FLUSH;
    device.pipe(serverCompressor).pipe(clientStream);
    //截获服务器信息
    serverStream.ondata = function(data, start, end) {
        serverParser.parse(data, start, end);
    };
    serverStream.on("end", serverStream.onend = function() {
        //console.log("ServerStream end");
    });
    serverStream.on("close", function() {
        //console.log("ServerStream close");
    });

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
                //fs.writeFileSync("data/" + getId() + ".server.json", pkg.rootNode().stringify());
                device.receivePackage(pkg);
                break;
            default:
                //console.log("Unknow package type:" + pkg.type + "!");
        }
    };
    device.onCommand = function(str) {
        self.emit("command", str, device);
    };

    //console.log("Client connect.");
}
// }}}

var WRITE_FORCE = true;

function SiriDevice() { // Device {{{

    Stream.call(this);
    this.writable = false;
    this.readable = true;

    this.serverResponse = [];
    this.proxied = true;
    this.completed = true;

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

SiriDevice.prototype.getCompletedPackage = function() {
    return new parser.ACEBinaryPlist(bplist.fromPObject({
        "properties": {
            "callbacks": []
        },
        "refId": "string:" + this.refId,
        "v": "string:" + this.version,
        "class": "string:RequestCompleted",
        "aceId": "string:" + this.aceId,
        "group": "string:com.apple.ace.system"
    }));
};

SiriDevice.prototype.writePackage = function(pkg, check) {
    if (check !== WRITE_FORCE && this.completed) return;
    this.emit('data', pkg.getData());
};

SiriDevice.prototype.receivePackage = function(pkg) {
    var obj = pkg.rootNode().toObject();

    this.refId = obj.refId;
    this.aceId = obj.aceId;
    this.version = obj.v;

    switch (obj["class"]) {
        case "SpeechRecognized":
            this.serverResponse = [];
            this.proxied = false;
            this.completed = false;

            this.writePackage(pkg, WRITE_FORCE);
            this.onCommand(getRecognizedText(obj));
            break;
        default:
            if (this.proxied) {
                this.writePackage(pkg, WRITE_FORCE);
            } else {
                this.serverResponse.push(pkg);
            }
            break;
    }
};

SiriDevice.prototype.proxy = function() {
    var self = this;
    this.serverResponse.forEach(function(pkg, index) {
        self.writePackage(pkg);
    });
    this.proxied = true;
    this.completed = true;
};

SiriDevice.prototype.say = function(str, speakable) {
    this.writePackage(new parser.ACEBinaryPlist(bplist.fromPObject({
        "properties": {
            "temporary": "null:false",
            "dialogPhase": "string:Completion",
            "scrollToTop": "null:false",
            "views": [{
                "class": "string:AssistantUtteranceView",
                "properties": {
                    "dialogIdentifier": "string:Misc#answer",
                    "speakableText": "unicode:" + (speakable === undefined ? str : speakable),
                    "text": "unicode:" + str
                },
                "group": "string:com.apple.ace.assistant"
            }]
        },
        "refId": "string:" + this.refId,
        "v": "string:" + this.version,
        "class": "string:AddViews",
        "aceId": "string:" + this.aceId,
        "group": "string:com.apple.ace.assistant"
    })));
};

SiriDevice.prototype.end = function(str) {
    if (str !== undefined) this.say(str);
    this.writePackage(this.getCompletedPackage());
    this.completed = true;
};
// }}}

// vim600: sw=4 ts=4 fdm=marker syn=javascript
