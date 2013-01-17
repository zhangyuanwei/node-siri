var util = require('util'),
    zlib = require('zlib'),
    assert = require('assert').ok,
    //EventEmitter = require('events').EventEmitter,

    bplist = require('./bplist'),
    Fifo = require('./fifo');

// {{{ 流分析器
function StreamParser() {
    var self = this;
    //EventEmitter.call(this);
    this.fifo = new Fifo(function(buffer, start, end) {
        return self.execute(buffer, start, end);
    });
}
//util.inherits(StreamParser, EventEmitter);
StreamParser.prototype.parse = function(buffer, start, end) {
    if (end === undefined) {
        end = buffer.length;
    }

    if (start === undefined) {
        start = 0;
    }

    this.fifo.push(buffer, start, end);
};
StreamParser.prototype.execute = function(buffer, start, end) {
    return end;
};

StreamParser.prototype.onAccept = function() {
    //Do nothing
};

StreamParser.prototype.onError = function(msg) {
    throw new Error(msg);
};
//}}}

// {{{ 协议包

var PKG_TYPE_MASK = 0xf0,
    PKG_TYPE_HTTP = 0x10,

    PKG_HTTP_HEADER = PKG_TYPE_HTTP | 1,
    PKG_HTTP_ACEHEADER = PKG_TYPE_HTTP | 2,
    PKG_HTTP_UNKNOW = PKG_TYPE_HTTP | 3,

    PKG_TYPE_ACE = 0x20,
    PKG_ACE_PLIST = PKG_TYPE_ACE | 1,
    PKG_ACE_UNKNOW = PKG_TYPE_ACE | 2;

exports.PKG_TYPE_MASK = PKG_TYPE_MASK;
exports.PKG_TYPE_HTTP = PKG_TYPE_HTTP;
exports.PKG_HTTP_HEADER = PKG_HTTP_HEADER;
exports.PKG_HTTP_ACEHEADER = PKG_HTTP_ACEHEADER;
exports.PKG_HTTP_UNKNOW = PKG_HTTP_UNKNOW;
exports.PKG_TYPE_ACE = PKG_TYPE_ACE;
exports.PKG_ACE_PLIST = PKG_ACE_PLIST;
exports.PKG_ACE_UNKNOW = PKG_ACE_UNKNOW;

function Package(type, data) {
    this.type = type;
    this.data = data;
}
exports.Package = Package;

Package.prototype.getData = function() {
    return this.data;
};

Package.prototype.getType = function() {
    return this.type;
};

function HTTPRequestHeader(obj) {
    var tmp = [];
    tmp.push(obj.method, " ", obj.uri, " HTTP/", obj.version, "\r\n");
    obj.headers.forEach(function(header, index, array) {
        tmp.push(header.name, ":", header.value, "\r\n");
    });
    tmp.push("\r\n")

    Package.call(this, PKG_HTTP_HEADER, new Buffer(tmp.join(""), "ascii"));
}
util.inherits(HTTPRequestHeader, Package);
exports.HTTPRequestHeader = HTTPRequestHeader;

function HTTPResponseHeader(obj) {
    var tmp = [];
    tmp.push("HTTP/", obj.version, " ", obj.code, " ", obj.reason, "\r\n");
    obj.headers.forEach(function(header, index, array) {
        tmp.push(header.name, ":", header.value, "\r\n");
    });
    tmp.push("\r\n")
    Package.call(this, PKG_HTTP_HEADER, new Buffer(tmp.join(""), "ascii"));
}
util.inherits(HTTPResponseHeader, Package);
exports.HTTPResponseHeader = HTTPResponseHeader;

function ACEPackage(type, size, data) {
    var buffer = new Buffer([type, 0x00, 0x00, 0x00, 0x00]);
    buffer.writeInt32BE(size, 1);
    if (data) buffer = Buffer.concat([buffer, data]);
    Package.call(this, PKG_ACE_UNKNOW, buffer);
}
util.inherits(ACEPackage, Package);
exports.ACEPackage = ACEPackage;

function ACEBinaryPlist(buffer) {
    this.root = null;
    this.buffer = null;

    if (!Buffer.isBuffer(buffer)) {
        this.root = buffer;
        buffer = bplist.toBuffer(buffer);
    }
    ACEPackage.call(this, TYPE_PLIST, buffer.length, buffer);

    this.type = PKG_ACE_PLIST;
    this.buffer = buffer;
}
util.inherits(ACEBinaryPlist, ACEPackage);
exports.ACEBinaryPlist = ACEBinaryPlist;

ACEBinaryPlist.prototype.rootNode = function() {
    if (!this.root) this.root = bplist.fromBuffer(this.buffer);
    return this.root;
};

// }}}

// {{{ Siri协议分析器
var CR = 0x0d,
    LF = 0x0a,
    AACCEE02 = [0xaa, 0xcc, 0xee, 0x02],
    ACEHeaderBuffer = new Buffer(AACCEE02),
    MAX_HTTP_HEADER_SIZE = 256,

    PACKAGE_EVENT = "package",

    SIRI_REQUEST = 0,
    SIRI_RESPONSE = 1,

    STA_RES_STATUS = 0,
    STA_REQ_REQUEST = 1,
    STA_HTTP_HEADER = 2,
    STA_ACE_HEADER = 3,
    STA_ACE_PAYLOAD = 4,
    STA_PASSTHROUGH = 5;

exports.SIRI_REQUEST = SIRI_REQUEST;
exports.SIRI_RESPONSE = SIRI_RESPONSE;

function SiriParser(type) {
    StreamParser.call(this);

    var self = this;
    this.type = type;
    this.state = type == SIRI_RESPONSE ? STA_RES_STATUS : STA_REQ_REQUEST;

    this.unzip = null;
    this.storage = null;
}

util.inherits(SiriParser, StreamParser);
exports.SiriParser = SiriParser;

function getLine(buffer, start, end) {
    var index, ret = false;
    for (index = start; index < end; index++) {
        if (buffer[index] == LF) {
            end = index + 1;
            if (index > 0 && buffer[index] == CR) {
                index--;
            }
            ret = {
                line: buffer.toString("ascii", start, index - 1),
                start: start,
                end: end
            };
            break;
        }
    }
    return ret;
}

//*
SiriParser.prototype.initUnzip = function() {
    var self = this,
        packageParser = new PackageParser();
    this.unzip = zlib.createUnzip();

    this.unzip.on("data", function(data) {
        packageParser.parse(data);
    });

    packageParser.onAccept = function(type, size, data) {
        if (type == TYPE_PLIST) {
            self.onAccept(new ACEBinaryPlist(data));
        } else {
            self.onAccept(new ACEPackage(type, size, data));
        }
    };

    packageParser.onError = function(msg) {
        self.onError("ACE:" + msg);
    }
};

SiriParser.prototype.unzipData = function(buffer, start, end) {
    assert(this.unzip);
    this.unzip.write(buffer.slice(start, end));
};
//*/

/*
SiriParser.prototype.initUnzip = function() {
    this.unzip = require('fs').openSync("ace.dat", "a+");
};
SiriParser.prototype.unzipData = function(buffer, start, end) {
    require('fs').write(this.unzip, buffer, start, end - start);
};
//*/

SiriParser.prototype.execute = function(buffer, start, end) {
    var tmp, matches;

    switch (this.state) {
        case STA_REQ_REQUEST:
            if ((tmp = getLine(buffer, start, end)) !== false) {
                if (matches = tmp.line.match(/^(\w+)\s+([\w%\/-]+)\s+HTTP\/(\d+(\.\d+)?)$/)) {
                    this.storage = {
                        method: matches[1],
                        uri: matches[2],
                        version: matches[3],
                        headers: []
                    };
                    this.state = STA_HTTP_HEADER;
                    start = tmp.end;
                } else {
                    this.onError("Requie ACE request line.");
                }
            } else if (end - start > MAX_HTTP_HEADER_SIZE) {
                this.onError("Request line overflow.");
            }
            break;
        case STA_RES_STATUS:
            if ((tmp = getLine(buffer, start, end)) !== false) {
                if (matches = tmp.line.match(/^HTTP\/(\d+(\.\d+)?)\s+(\d+)\s+(.*)$/)) {
                    this.storage = {
                        code: matches[3],
                        reason: matches[4],
                        version: matches[1],
                        headers: []
                    };
                    this.state = STA_HTTP_HEADER;
                    start = tmp.end;
                } else {
                    this.onError("Requie response status line.");
                }
            } else if (end - start > MAX_HTTP_HEADER_SIZE) {
                this.onError("Response status line overflow.");
            }
            break;
        case STA_HTTP_HEADER:
            if ((tmp = getLine(buffer, start, end)) !== false) {
                if (tmp.line === "") {
                    this.onAccept(this.type == SIRI_RESPONSE ? new HTTPResponseHeader(this.storage) : new HTTPRequestHeader(this.storage));
                    this.state = STA_ACE_HEADER;
                    start = tmp.end;
                } else if (matches = tmp.line.match(/^([\w-]+)\s*:\s*(.*)$/)) {
                    this.storage.headers.push({
                        name: matches[1],
                        value: matches[2]
                    });
                    start = tmp.end;
                } else {
                    this.onError("Requie HTTP header line.");
                }
            } else if (end - start > MAX_HTTP_HEADER_SIZE) {
                this.onError("HTTP header overflow.");
            }
            break;
        case STA_ACE_HEADER:
            if (end - start >= 4 /*AACCEE02.length*/ ) {
                tmp = true;
                AACCEE02.forEach(function(code, index, array) {
                    if (buffer[start + index] != code) {
                        tmp = false;
                    }
                });
                if (tmp) {
                    this.onAccept(new Package(PKG_HTTP_ACEHEADER, ACEHeaderBuffer));
                    this.initUnzip();
                    start = start + 4;
                    this.state = STA_ACE_PAYLOAD;
                } else {
                    console.log("switch STA_PASSTHROUGH state...\n" + buffer.slice(start, end));
                    this.state = STA_PASSTHROUGH;
                    start = true;
                }
            }
            break;
        case STA_ACE_PAYLOAD:
            this.unzipData(buffer, start, end);
            start = end;
            break;
        case STA_PASSTHROUGH:
            this.onAccept(new Package(PKG_HTTP_UNKNOW, buffer.slice(start, end)));
            start = end;
            break;
        default:
            this.onError("Unknow state.");
            break;
    }
    return start;
};
// }}}

// {{{ ACE 协议分析器
var STA_PKG_TYPE = 1,
    STA_PKG_SIZE = 2,
    STA_PKG_DATA = 3,

    TYPE_PLIST = 0x02,
    TYPE_PING = 0x03,
    TYPE_PONG = 0x04,
    TYPE_END = 0xFF;

function PackageParser() {
    StreamParser.call(this);
    this.state = STA_PKG_TYPE;
    this.packageType = null;
    this.packageSize = 0;
}
util.inherits(PackageParser, StreamParser);

PackageParser.prototype.execute = function(buffer, start, end) {
    //console.log('======================');
    //console.log(buffer, start, end, this.state);
    switch (this.state) {
        case STA_PKG_TYPE:
            this.packageType = buffer[start];
            this.state = STA_PKG_SIZE;
            start++;
            break;

        case STA_PKG_SIZE:
            if (end - start < 4) break;
            this.packageSize = buffer.readInt32BE(start);
            switch (this.packageType) {
                case TYPE_PLIST:
                    this.state = STA_PKG_DATA;
                    break;
                case TYPE_PING:
                case TYPE_PONG:
                case TYPE_END:
                    this.onAccept(this.packageType, this.packageSize);
                    this.state = STA_PKG_TYPE;
                    break;
                default:
                    console.log(buffer.slice(start, end));
                    this.onError("Unknow ACE package type\"" + this.packageType + "\".");
                    break;
            }
            start += 4;
            break;

        case STA_PKG_DATA:
            if (end - start < this.packageSize) break;
            this.onAccept(this.packageType, this.packageSize, buffer.slice(start, start + this.packageSize));
            this.state = STA_PKG_TYPE;
            start += this.packageSize;
            break;
        default:
            //TODO Error
    }
    return start;
};

// }}}

// vim600: sw=4 ts=4 fdm=marker syn=javascript
