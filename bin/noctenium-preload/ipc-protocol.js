/* Copyright (C) 2026 AnEmanator. All Rights Reserved. */

'use strict';

const EventEmitter = require('events');

const TYPE = Object.freeze({
    Hello: 1,
    HelloAck: 2,
    SessionStart: 3,
    SessionReady: 4,
    Packet: 5,
    PacketResult: 6,
    AsyncInject: 7,
    Status: 8,
    SessionEnd: 9,
    TciSend: 10,
    TciEvent: 11,
    Ping: 12,
    Pong: 13,
    SessionActivate: 14,
    SessionActive: 15,
    Intercepts: 16,
    Auth: 17,
    AuthAck: 18
});

const RESULT = Object.freeze({ Pass: 0, Modified: 1, Silenced: 2 });
const HEADER = 12;
const MAX_FRAME = 16 * 1024 * 1024;

function encodeFrame(type, requestId = 0, payload = Buffer.alloc(0), flags = 0) {
    payload = Buffer.from(payload);
    const bodyLen = 8 + payload.length;
    if (bodyLen > MAX_FRAME) throw new Error(`IPC frame too large: ${bodyLen}`);
    const out = Buffer.allocUnsafe(4 + bodyLen);
    out.writeUInt32LE(bodyLen, 0);
    out[4] = type & 0xff;
    out[5] = flags & 0xff;
    out.writeUInt16LE(0, 6);
    out.writeUInt32LE(requestId >>> 0, 8);
    payload.copy(out, HEADER);
    return out;
}
function jsonPayload(value) {
    return Buffer.from(JSON.stringify(value ?? {}), 'utf8');
}
function parseJson(payload) {
    return JSON.parse(Buffer.from(payload).toString('utf8'));
}

function encodePacket({ connId, direction, keyState = 0, opcode, packet }) {
    packet = Buffer.from(packet);
    const out = Buffer.allocUnsafe(12 + packet.length);
    out.writeUInt32LE(connId >>> 0, 0);
    out[4] = direction & 0xff;
    out[5] = keyState & 0xff;
    out.writeUInt16LE(opcode & 0xffff, 6);
    out.writeUInt32LE(packet.length, 8);
    packet.copy(out, 12);
    return out;
}
function decodePacket(payload) {
    payload = Buffer.from(payload);
    if (payload.length < 12) throw new Error('short IPC packet payload');
    const len = payload.readUInt32LE(8);
    if (len > 65535 || payload.length !== 12 + len) throw new Error(`bad IPC packet length ${len}`);
    return {
        connId: payload.readUInt32LE(0),
        direction: payload[4],
        keyState: payload[5],
        opcode: payload.readUInt16LE(6),
        packet: Buffer.from(payload.subarray(12))
    };
}
function encodePacketResult(result, modified, effects = []) {
    modified = Buffer.isBuffer(modified) ? modified : Buffer.alloc(0);
    const validEffects = effects.filter(e => e && Buffer.isBuffer(e.data));
    let total = 8 + modified.length;
    for (const e of validEffects) total += 8 + e.data.length;
    const out = Buffer.allocUnsafe(total);
    out[0] = result & 0xff;
    out[1] = 0;
    out.writeUInt16LE(validEffects.length, 2);
    out.writeUInt32LE(modified.length, 4);
    let pos = 8;
    modified.copy(out, pos);
    pos += modified.length;
    for (const e of validEffects) {
        out[pos] = e.direction & 0xff;
        out[pos + 1] = out[pos + 2] = out[pos + 3] = 0;
        out.writeUInt32LE(e.data.length, pos + 4);
        e.data.copy(out, pos + 8);
        pos += 8 + e.data.length;
    }
    return out;
}
function decodePacketResult(payload) {
    payload = Buffer.from(payload);
    if (payload.length < 8) throw new Error('short packet-result payload');
    const result = payload[0],
        count = payload.readUInt16LE(2),
        modifiedLen = payload.readUInt32LE(4);
    let pos = 8;
    if (modifiedLen > 65535 || pos + modifiedLen > payload.length) throw new Error('bad modified packet length');
    const modified = modifiedLen ? Buffer.from(payload.subarray(pos, pos + modifiedLen)) : null;
    pos += modifiedLen;
    const effects = [];
    for (let i = 0; i < count; i++) {
        if (pos + 8 > payload.length) throw new Error('short side-effect header');
        const direction = payload[pos],
            len = payload.readUInt32LE(pos + 4);
        pos += 8;
        if (len > 65535 || pos + len > payload.length) throw new Error('bad side-effect length');
        effects.push({ direction, data: Buffer.from(payload.subarray(pos, pos + len)) });
        pos += len;
    }
    if (pos !== payload.length) throw new Error('trailing bytes in packet-result');
    return { result, modified, effects };
}
function encodeAsyncInject(direction, packet) {
    packet = Buffer.from(packet);
    const out = Buffer.allocUnsafe(8 + packet.length);
    out[0] = direction & 0xff;
    out[1] = out[2] = out[3] = 0;
    out.writeUInt32LE(packet.length, 4);
    packet.copy(out, 8);
    return out;
}
function decodeAsyncInject(payload) {
    payload = Buffer.from(payload);
    if (payload.length < 8) throw new Error('short async-inject payload');
    const len = payload.readUInt32LE(4);
    if (len > 65535 || payload.length !== 8 + len) throw new Error('bad async-inject length');
    return { direction: payload[0], packet: Buffer.from(payload.subarray(8)) };
}

class Peer extends EventEmitter {
    constructor(socket) {
        super();
        this.socket = socket;
        this.buffer = Buffer.alloc(0);
        socket.on('data', c => this.onData(Buffer.from(c)));
        socket.on('error', e => this.emit('error', e));
        socket.on('close', () => this.emit('close'));
    }
    send(type, requestId, payload, flags = 0) {
        if (!this.socket || this.socket.destroyed) return false;
        return this.socket.write(encodeFrame(type, requestId, payload, flags));
    }
    sendJson(type, requestId, value) {
        return this.send(type, requestId, jsonPayload(value));
    }
    onData(chunk) {
        this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
        for (;;) {
            if (this.buffer.length < 4) return;
            const bodyLen = this.buffer.readUInt32LE(0);
            if (bodyLen < 8 || bodyLen > MAX_FRAME) {
                this.socket.destroy(new Error(`invalid IPC frame ${bodyLen}`));
                return;
            }
            if (this.buffer.length < 4 + bodyLen) return;
            const frame = this.buffer.subarray(4, 4 + bodyLen);
            this.buffer = this.buffer.subarray(4 + bodyLen);
            this.emit('frame', {
                type: frame[0],
                flags: frame[1],
                requestId: frame.readUInt32LE(4),
                payload: Buffer.from(frame.subarray(8))
            });
        }
    }
    close() {
        try {
            this.socket.end();
        } catch (_) {}
    }
}

module.exports = {
    TYPE,
    RESULT,
    Peer,
    encodeFrame,
    jsonPayload,
    parseJson,
    encodePacket,
    decodePacket,
    encodePacketResult,
    decodePacketResult,
    encodeAsyncInject,
    decodeAsyncInject
};
