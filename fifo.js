'use strict';

function Fifo(callback) {
    this.callback = callback;

    this.buffer = null;
    this.bufferSize = 0;
    this.bufferEnd = 0;
    this.bufferStart = 0;
}

Fifo.prototype.push = function(buffer, start, end) {
    var length = end - start,
        cache = this.bufferEnd - this.bufferStart,
        free, tmp;

    if (cache > 0) {
        free = this.bufferSize - this.bufferEnd;
        if (free < length) {
            if (this.bufferSize < length + cache) {
                this.bufferSize += length;

                this.buffer = Buffer.concat(
                [this.buffer.slice(this.bufferStart, this.bufferEnd),
                buffer.slice(start, end)],
                this.bufferSize);
            } else {
                this.buffer.copy(this.buffer, 0, this.bufferStart, this.bufferEnd);
                buffer.copy(this.buffer, this.bufferEnd, start, end);
            }
            this.bufferEnd = cache + length;
            this.bufferStart = 0;
        } else {
            buffer.copy(this.buffer, this.bufferEnd, start, end);
            this.bufferEnd += length;
        }
        buffer = this.buffer;
        start = this.bufferStart;
        end = this.bufferEnd;
    }

    do {
        tmp = start;
        start = this.callback(buffer, start, end);
        if (start === true) {
            start = tmp;
            continue;
        } else if (start === false) {
            start = tmp;
            break;
        }
    } while (start < end && tmp < start);

    if (start < end) {
        length = end - start;

        if (cache) {
            this.bufferStart = start;
        } else {
            if (this.bufferSize < length) {
                this.bufferSize = length << 2;
                this.buffer = new Buffer(this.bufferSize);
            }
            buffer.copy(this.buffer, 0, start, end);
            this.bufferStart = 0;
            this.bufferEnd = length;
        }
    } else {
        this.bufferStart = this.bufferEnd = 0;
    }
};

module.exports = Fifo;
