var util = require('util'),

    BPLIST_NULL = 0x00,
    BPLIST_FALSE = 0x08,
    BPLIST_TRUE = 0x09,
    BPLIST_FILL = 0x0F,
    /* will be used for length grabbing */
    BPLIST_UINT = 0x10,
    BPLIST_REAL = 0x20,
    BPLIST_DATE = 0x30,
    BPLIST_DATA = 0x40,
    BPLIST_STRING = 0x50,
    BPLIST_UNICODE = 0x60,
    BPLIST_UID = 0x70,
    BPLIST_ARRAY = 0xA0,
    BPLIST_SET = 0xC0,
    BPLIST_DICT = 0xD0,
    BPLIST_MASK = 0xF0;

function error(str) {
    throw new Error(str || "Error");
}

// {{{ BPlistNode

function BPlistPlainNode(type, value) {
    this.type = type;
    this.value = value;
}

BPlistPlainNode.prototype.stringify = function() {
    return JSON.stringify(this.toObject());
};

BPlistPlainNode.prototype.toObject = function() {
    return this.value;
};

BPlistPlainNode.prototype.hash = function() {
    return [(this.type >> 4).toString(16), hashEncode(this.valueHash())].join(":");
};

BPlistPlainNode.prototype.valueHash = function() {
    return String(this.value);
};

function BPlistArrayNode() {
    BPlistPlainNode.call(this, BPLIST_ARRAY, []);
    this.indexs = null;
}
util.inherits(BPlistArrayNode, BPlistPlainNode);

BPlistArrayNode.prototype.push = function(value) {
    this.value.push(value);
};

BPlistArrayNode.prototype.toObject = function() {
    var ret = [],
        count = this.value.length;
    while (count--) {
        ret.unshift(this.value[count].toObject());
    }

    return ret;
};

BPlistArrayNode.prototype.valueHash = function() {
    var tmp = [],
        count = this.value.length;
    while (count--) {
        tmp.unshift(hashEncode(this.value[count].hash()));
    }
    return tmp.join(",");
};

function BPlistDictNode() {
    BPlistPlainNode.call(this, BPLIST_DICT, []);
    this.indexs = null;
}
util.inherits(BPlistDictNode, BPlistPlainNode);

BPlistDictNode.prototype.push = function(key, value) {
    this.value.push([key, value]);
};

BPlistDictNode.prototype.toObject = function() {
    var ret = {},
    count = this.value.length,
        index, item, key, value;

    for (index = 0; index < count; index++) {
        item = this.value[index];
        key = item[0].value;
        value = item[1].toObject();
        ret[key] = value;
    }

    return ret;
};

BPlistDictNode.prototype.valueHash = function() {
    var tmp = [],
        count = this.value.length,
        item;
    while (count--) {
        item = this.value[count];
        tmp.unshift([hashEncode(item[0].value), hashEncode(item[1].hash())].join(":"));
    }
    return tmp.join(",");
};

function BPlistData(buffer) {
    this.buffer = buffer;
}
BPlistData.prototype.toJSON = function() {
    return this.buffer.toString("base64");
};

function BPlistDataNode(buffer) {
    BPlistPlainNode.call(this, BPLIST_DATA, new BPlistData(buffer));
}
util.inherits(BPlistDataNode, BPlistPlainNode);

BPlistDataNode.prototype.valueHash = function() {
    return this.value.toString("base64");
};


function hashEncode(str) {
    return String(str)
        .replace("\\", "\\\\")
        .replace(",", "\\,")
        .replace(":", "\\:");
}

// }}}

// {{{ BPlistBuffer 
var BPLIST_MAGIC = "bplist",
    BPLIST_MAGIC_SIZE = 6,

    BPLIST_VERSION = "00",
    BPLIST_VERSION_SIZE = 2,

    //BPLIST_TRL_SIZE = 26,
    //BPLIST_TRL_OFFSIZE_IDX = 0,
    //BPLIST_TRL_PARMSIZE_IDX = 1,
    //BPLIST_TRL_NUMOBJ_IDX = 2,
    //BPLIST_TRL_ROOTOBJ_IDX = 10,
    //BPLIST_TRL_OFFTAB_IDX = 18,
    //
    BPLIST_TRL_SIZE = 32,
    BPLIST_TRL_OFFSIZE_IDX = 6,
    BPLIST_TRL_PARMSIZE_IDX = 7,
    BPLIST_TRL_NUMOBJ_IDX = 8,
    BPLIST_TRL_ROOTOBJ_IDX = 16,
    BPLIST_TRL_OFFTAB_IDX = 24,
    /* default buffer size */
    BPLIST_BUFFER_MIN_SIZE = 256;

function BPlistBuffer(buffer, start, end) { // 构造函数 {{{
    if (Buffer.isBuffer(buffer)) {
        this.start = start;
        this.end = end;
        this.buffer = buffer;
    } else {
        this.start = 0;
        this.end = Math.max((buffer || 0) << 1, BPLIST_BUFFER_MIN_SIZE);
        this.buffer = new Buffer(this.end);
        this.buffer.fill(0x00);
    }
    this.offset = this.start;

    this.offsetSize = 0; //节点偏移地址字段大小
    this.dictParamSize = 0; //索引字段大小
    this.numObjects = 0; //节点总数
    this.rootObject = 0; //根节点索引
    this.offsetTableIndex = 0; //索引表偏移地址

    this.objectIndex = 0;

    this.type = BPLIST_NULL;
    this.size = BPLIST_NULL;
    this.inited = false;
} // }}}

BPlistBuffer.prototype.initParam = function() { // 解析参数 {{{
    if (this.inited) return;
    var length = this.end - this.start,
        offset = this.start,
        trailer = this.end - BPLIST_TRL_SIZE;

    if (length < BPLIST_MAGIC_SIZE + BPLIST_VERSION_SIZE + BPLIST_TRL_SIZE) {
        error();
    }

    if (this.buffer.toString("ascii", offset, offset + BPLIST_MAGIC_SIZE) !== BPLIST_MAGIC) {
        error();
    }
    offset += BPLIST_MAGIC_SIZE;

    if (this.buffer.toString("ascii", offset, offset + BPLIST_VERSION_SIZE) !== BPLIST_VERSION) {
        error();
    }

    this.offsetSize = this.buffer[trailer + BPLIST_TRL_OFFSIZE_IDX];
    this.dictParamSize = this.buffer[trailer + BPLIST_TRL_PARMSIZE_IDX];
    this.numObjects = this.getUint(trailer + BPLIST_TRL_NUMOBJ_IDX, 8);
    this.rootObject = this.getUint(trailer + BPLIST_TRL_ROOTOBJ_IDX, 8);
    this.offsetTableIndex = this.getUint(trailer + BPLIST_TRL_OFFTAB_IDX, 8);

}; // }}}

BPlistBuffer.prototype.getUint = function(offset, size) { // 读取无符号整型 {{{
    switch (size) {
        case 1:
            return this.buffer[offset];
        case 2:
            return this.buffer.readUInt16BE(offset);
        case 4:
            return this.buffer.readUInt32BE(offset);
        case 8:
            return this.buffer.readUInt32BE(offset) * 0x100000000 + this.buffer.readUInt32BE(offset + 4);
        default:
            error("Unknow size " + size);
    }
}; // }}}

BPlistBuffer.prototype.next = function() { // 解析下一个节点 {{{
    var tmp;

    if (this.offset < this.start || this.offset >= this.end) return false;
    tmp = this.buffer[this.offset];
    this.type = tmp & BPLIST_MASK;
    this.size = tmp & BPLIST_FILL;
    this.offset++;
    return true;
}; // }}}

BPlistBuffer.prototype.readSize = function() { // 得到扩展Size(大于15的) {{{
    var size = this.size;
    if (size == BPLIST_FILL) {
        if (this.next() && this.type == BPLIST_UINT) {
            size = this.readUint();
        } else {
            error();
        }
    }
    return size;
}; // }}}

BPlistBuffer.prototype.readNull = function() { // 得到NULL类型 true false null {{{
    switch (this.size) {
        case BPLIST_TRUE:
            return true;
        case BPLIST_FALSE:
            return false;
        case BPLIST_NULL:
        default:
            return null;
    }
}; // }}}

BPlistBuffer.prototype.readUint = function() { // 得到无符号整型 {{{
    var offset = this.offset,
        size = 1 << this.size;
    this.offset += size;
    return this.getUint(offset, size);
}; // }}}

BPlistBuffer.prototype.readReal = function() { // 得到 real 类型 {{{
    var offset = this.offset,
        size = 1 << this.size;
    this.offset += size;
    switch (size) {
        case 4:
            return this.buffer.readFloatBE(offset);
        case 8:
            return this.buffer.readDoubleBE(offset);
        default:
            error();
    }
}; // }}}

BPlistBuffer.prototype.readData = function() { // 得到Data类型 {{{
    var size = this.readSize(),
        start = this.offset;
    this.offset += size;
    return this.buffer.slice(start, start + size);
}; // }}}

BPlistBuffer.prototype.readString = function() { // 得到字符串 {{{
    var size = this.readSize(),
        start = this.offset;
    this.offset += size;
    return this.buffer.toString("ascii", start, this.offset);
}; // }}}

BPlistBuffer.prototype.readUnicode = function() { // 得到Unicode字符串 {{{
    var size = this.readSize(),
        tmp, start, index;
    size <<= 1;
    tmp = new Buffer(size);
    start = this.offset;
    this.offset += size;
    for (index = 0; index < size; index += 2) {
        tmp.writeUInt16LE(this.buffer.readUInt16BE(start + index), index);
    }
    return tmp.toString("utf16le");
}; // }}}

BPlistBuffer.prototype.readList = function(size) { // 得到索引类型 {{{
    var offset = this.offset,
        ret = [];
    while (size--) {
        ret.push(this.getUint(offset, this.dictParamSize));
        offset += this.dictParamSize;
    }
    this.offset = offset;
    return ret;
};
// }}} 

BPlistBuffer.prototype.readNode = function() { // 得到节点 {{{
    if (!this.next()) return false;
    var node;
    switch (this.type) {
        case BPLIST_NULL:
            return new BPlistPlainNode(BPLIST_NULL, this.readNull());
        case BPLIST_UINT:
            return new BPlistPlainNode(BPLIST_UINT, this.readUint());
        case BPLIST_REAL:
            return new BPlistPlainNode(BPLIST_REAL, this.readReal());
            //case BPLIST_DATE:
        case BPLIST_DATA:
            return new BPlistDataNode(this.readData());
        case BPLIST_STRING:
            return new BPlistPlainNode(BPLIST_STRING, this.readString());
        case BPLIST_UNICODE:
            return new BPlistPlainNode(BPLIST_UNICODE, this.readUnicode());
        case BPLIST_UID:
        case BPLIST_ARRAY:
            node = new BPlistArrayNode();
            node.indexs = this.readList(this.readSize());
            return node;
        case BPLIST_SET:
        case BPLIST_DICT:
            node = new BPlistDictNode();
            node.indexs = this.readList(this.readSize() << 1);
            return node;
        default:
            error("Unknow type " + this.type);
    }
}; // }}}

BPlistBuffer.prototype.nextNode = function() { // 得到下一个节点 {{{
    if (this.objectIndex >= this.numObjects) return false;
    var offsetTable = this.start + this.offsetTableIndex;
    this.offset = this.start + this.getUint(offsetTable + this.objectIndex * this.offsetSize, this.offsetSize);
    this.objectIndex++;
    return this.readNode();
}; // }}}

BPlistBuffer.prototype.readPlist = function() { // 解析整个树并得到跟节点 {{{
    var nodeslist, node, index, count;

    this.initParam();

    nodeslist = [];
    while (node = this.nextNode()) {
        nodeslist.push(node);
    }

    nodeslist.forEach(function(node) {
        switch (node.type) {
            case BPLIST_ARRAY:
                for (index = 0, count = node.indexs.length; index < count; index++) {
                    node.push(nodeslist[node.indexs[index]]);
                }
                break;
            case BPLIST_DICT:
                for (index = 0, count = node.indexs.length >> 1; index < count; index++) {
                    node.push(
                    nodeslist[node.indexs[index]],
                    nodeslist[node.indexs[index + count]]);
                }
                break;
        }
    });

    return nodeslist[this.rootObject] || false;
}; // }}}

BPlistBuffer.prototype.malloc = function(size) { // 申请空间 {{{
    var buffer, used, length;
    if (this.end - this.offset < size) {
        used = this.offset - this.start;
        length = (used + size) << 1;
        buffer = new Buffer(length);
        buffer.fill(0x00);
        this.buffer.copy(buffer, 0, this.start, this.end);
        this.start = 0;
        this.end = length;
        this.buffer = buffer;
        this.offset = used;
    }
}; // }}}

BPlistBuffer.prototype.getUintSize = function(value) { // 得到正整数Size {{{
    return (value < 1 << 8 ? 1 : (value < 1 << 16 ? 2 : (value < 1 << 32 ? 4 : 8)));
}; // }}}

BPlistBuffer.prototype.setUint = function(offset, value, size) { // {{{ 写入一个整型
    switch (size) {
        case 1:
            this.buffer[offset] = value;
            break;
        case 2:
            this.buffer.writeUInt16BE(value, offset);
            break;
        case 4:
            this.buffer.writeUInt32BE(value, offset);
            break;
        case 8:
            this.buffer.writeUInt32BE(value / 0x100000000 | 0, offset);
            this.buffer.writeUInt32BE(value | 0, offset + 4);
            break;
        default:
            error();
            break;
    }
    return size;
}; // }}}

BPlistBuffer.prototype.writeHeader = function() { // 写入头部标识 {{{
    this.malloc(BPLIST_MAGIC_SIZE + BPLIST_VERSION_SIZE);
    this.buffer.write(BPLIST_MAGIC, this.offset, BPLIST_MAGIC_SIZE, "ascii");
    this.offset += BPLIST_MAGIC_SIZE;
    this.buffer.write(BPLIST_VERSION, this.offset, BPLIST_VERSION_SIZE, "ascii");
    this.offset += BPLIST_VERSION_SIZE;

}; // }}}

BPlistBuffer.prototype.writeOffsetTable = function(table) { // 写入索引表 {{{
    var length = table.length,
        size = this.offsetSize,
        index = 0,
        offset;
    this.malloc(size * length);
    offset = this.offset;
    for (index = 0; index < length; index++) {
        this.setUint(offset, table[index], size);
        offset += size;
    }
    this.offset = offset;
}; // }}}

BPlistBuffer.prototype.writeTrailer = function() { // 写入尾部数据 {{{
    var offset;
    offset = this.offset;

    this.malloc(BPLIST_TRL_SIZE);
    this.setUint(offset + BPLIST_TRL_OFFSIZE_IDX, this.offsetSize, 1);
    this.setUint(offset + BPLIST_TRL_PARMSIZE_IDX, this.dictParamSize, 1);
    this.setUint(offset + BPLIST_TRL_NUMOBJ_IDX, this.numObjects, 8);
    this.setUint(offset + BPLIST_TRL_ROOTOBJ_IDX, this.rootObject, 8);
    this.setUint(offset + BPLIST_TRL_OFFTAB_IDX, this.offsetTableIndex, 8);
    this.offset = offset + BPLIST_TRL_SIZE;

}; // }}}

BPlistBuffer.prototype.writeType = function(type) { // 写入type {{{
    this.malloc(1);
    type = (type & BPLIST_MASK) | (this.buffer[this.offset] & BPLIST_FILL);
    this.buffer[this.offset] = type;
}; // }}}

BPlistBuffer.prototype.writeSize = function(size) { // 写入size {{{
    this.malloc(1);
    var offset = this.offset;
    if (size < BPLIST_FILL) {
        size = (size & BPLIST_FILL) | (this.buffer[offset] & BPLIST_MASK);
        this.buffer[offset] = size;
        this.offset++;
    } else {
        this.buffer[offset] = BPLIST_FILL | (this.buffer[offset] & BPLIST_MASK);
        this.offset++;
        this.writeType(BPLIST_UINT);
        this.writeUint(size);
    }
}; // }}} 

BPlistBuffer.prototype.writeNull = function(value) { // 写入NULL节点 {{{
    if (value === true) {
        this.writeSize(BPLIST_TRUE);
    } else if (value === false) {
        this.writeSize(BPLIST_FALSE);
    } else { //value === null
        this.writeSize(BPLIST_NULL);
    }
}; // }}}

BPlistBuffer.prototype.writeUint = function(value) { // 写入正整数 {{{
    var size, index;
    size = this.getUintSize(value);
    index = (size == 1 ? 0 : (size == 2 ? 1 : (size == 4 ? 2 : 3)));
    this.writeSize(index);
    this.malloc(size);
    this.setUint(this.offset, value, size);
    this.offset += size;
}; // }}}

BPlistBuffer.prototype.writeReal = function(value) { // 写入Real数 {{{
    var //index = (value < 3.4028234663852886e+38 && value > -3.4028234663852886e+38) ? 2 : 3,
    //TODO 修复判断逻辑
    index = 3,
        size = 1 << index;
    this.writeSize(index);
    this.malloc(size);
    switch (size) {
        case 4:
            this.buffer.writeFloatBE(value, this.offset);
            break;
        case 8:
            this.buffer.writeDoubleBE(value, this.offset);
            break;
        default:
            error();
    }
    this.offset += size;
}; // }}}

BPlistBuffer.prototype.writeData = function(value) { // 写入Data {{{
    var length = value.length;
    this.writeSize(length);
    this.malloc(length);
    value.copy(this.buffer, this.offset);
    this.offset += length;
}; // }}}

BPlistBuffer.prototype.writeString = function(value) { // 写入String {{{
    var length = value.length;
    this.writeSize(length);
    this.malloc(length);
    this.buffer.write(value, this.offset, length, "ascii");
    this.offset += length;
}; // }}}

BPlistBuffer.prototype.writeUnicode = function(value) { // 写入Unicode {{{
    var length = value.length,
        size = length << 1,
        offset, index;
    this.writeSize(length);
    this.malloc(size);
    offset = this.offset;
    this.buffer.write(value, offset, size, "utf16le");
    for (index = 0; index < length; index++, offset += 2) {
        this.buffer.writeUInt16BE(this.buffer.readUInt16LE(offset), offset);
    }
    this.offset += size;
}; // }}}

BPlistBuffer.prototype.writeList = function(value) { // 写入列表 {{{
    var count, index, length, offset;
    count = value.length;
    size = this.dictParamSize;
    length = count * size;
    this.malloc(length);

    offset = this.offset;

    for (index = 0; index < count; index++) {
        this.setUint(offset, value[index], size);
        offset += size;
    }
    this.offset = offset;
}; // }}}

BPlistBuffer.prototype.writeNode = function(node) { // 写入节点 {{{

    this.writeType(node.type);
    switch (node.type) {
        case BPLIST_NULL:
            this.writeNull(node.value);
            break;
        case BPLIST_UINT:
            this.writeUint(node.value);
            break;
        case BPLIST_REAL:
            this.writeReal(node.value);
            break;
            //case BPLIST_DATE:
        case BPLIST_DATA:
            this.writeData(node.value);
            break;
        case BPLIST_STRING:
            this.writeString(node.value);
            break;
        case BPLIST_UNICODE:
            this.writeUnicode(node.value);
            break;
        case BPLIST_UID:
        case BPLIST_ARRAY:
            this.writeSize(node.indexs.length);
            this.writeList(node.indexs);
            break;
        case BPLIST_SET:
        case BPLIST_DICT:
            this.writeSize(node.indexs.length >> 1);
            this.writeList(node.indexs);
            break;
        default:
            error();
    }
}; // }}}

BPlistBuffer.prototype.serializeNode = function(node, array, set) { // 找到所有节点，并且存储在数组中 {{{
    var hash = node.hash(),
        index, list, keys, values, count, i, kv;
    set = set || {}; //用于储存节点索引
    if (set.hasOwnProperty(hash)) return set[hash];

    index = array.push(node) - 1;
    set[hash] = index;

    switch (node.type) {
        case BPLIST_NULL:
        case BPLIST_UINT:
        case BPLIST_REAL:
            //case BPLIST_DATE:
        case BPLIST_DATA:
        case BPLIST_STRING:
        case BPLIST_UNICODE:
            break;
        case BPLIST_UID:
        case BPLIST_ARRAY:
            count = node.value.length;
            list = [];
            for (i = 0; i < count; i++) {
                list.push(this.serializeNode(node.value[i], array, set));
            }
            node.indexs = list;
            break;
        case BPLIST_SET:
        case BPLIST_DICT:
            count = node.value.length;
            keys = [];
            values = [];
            for (i = 0; i < count; i++) {
                kv = node.value[i];
                keys.push(this.serializeNode(kv[0], array, set));
                values.push(this.serializeNode(kv[1], array, set));
            }
            node.indexs = keys.concat(values);
            break;
        default:
            error();
    }
    return index;
}; // }}}

BPlistBuffer.prototype.writePlist = function(rootNode) { // 写入整个Plist结构 {{{
    var nodeslist = [],
        offsetTable = [],
        count, index;

    this.rootObject = this.serializeNode(rootNode, nodeslist);
    this.numObjects = count = nodeslist.length;
    this.dictParamSize = this.getUintSize(count);

    this.writeHeader();
    for (index = 0; index < count; index++) {
        offsetTable.push(this.offset - this.start);
        this.writeNode(nodeslist[index]);
    }

    this.offsetTableIndex = this.offset - this.start;
    this.offsetSize = this.getUintSize(this.offsetTableIndex);

    this.writeOffsetTable(offsetTable);

    this.writeTrailer();

    return this.buffer.slice(this.start, this.offset);
}; // }}}

// }}}

exports.fromBuffer = function(data, start, end) { // 解析bplist {{{
    var buffer, root;

    if (start === undefined) {
        start = 0;
    }
    if (end === undefined) {
        end = start + data.length;
    }

    buffer = new BPlistBuffer(data, start, end);
    root = buffer.readPlist();
    return root;
}; // }}}

exports.toBuffer = function(rootNode) { // 构建 bplist {{{
    var buffer = new BPlistBuffer(),
        data = buffer.writePlist(rootNode);
    return data;
}; // }}}

// vim600: sw=4 ts=4 fdm=marker syn=javascript
