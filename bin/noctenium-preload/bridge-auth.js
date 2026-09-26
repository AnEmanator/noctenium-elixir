/* Copyright (C) 2026 AnEmanator. All Rights Reserved. */

// Host side of the bridge handshake. Lazily loads the game-side addon (the same .node we ship
// to the game folder) and calls its host-role exports. Loaded here in Electron the addon's
// game-side gate is a no-op, only hostBegin / hostVerify run. Everything is null / false safe
// so a missing or broken library just fails the handshake instead of throwing.
'use strict';

const path = require('path');

let addon; // undefined = not tried yet, null = failed to load
function lib() {
    if (addon !== undefined) return addon;
    try {
        addon = require(path.join(__dirname, '..', '..', 'bridge', 'game-preload', 'toolbox-preload-bridge.node'));
    } catch (_) {
        addon = null;
    }
    return addon;
}

// begin(token, clientNonce) -> { nonce, proof } | null
function begin(token, clientNonce) {
    const a = lib();
    if (!a || typeof a.hostBegin !== 'function') return null;
    try {
        return a.hostBegin(String(token), String(clientNonce)) || null;
    } catch (_) {
        return null;
    }
}

// verify(token, clientNonce, hostNonce, clientProof) -> bool
function verify(token, clientNonce, hostNonce, clientProof) {
    const a = lib();
    if (!a || typeof a.hostVerify !== 'function') return false;
    try {
        return a.hostVerify(String(token), String(clientNonce), String(hostNonce), String(clientProof)) === true;
    } catch (_) {
        return false;
    }
}

function available() {
    const a = lib();
    return !!(a && typeof a.hostBegin === 'function' && typeof a.hostVerify === 'function');
}

module.exports = { begin, verify, available };
