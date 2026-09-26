/* Copyright (C) 2026 AnEmanator. All Rights Reserved. */

// Game-side bridge installer. Prints nothing, every call returns { ok, reason, ... } and the
// callers log it through explain().
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MARKER = '# noctenium-elixir-preload-bridge';
const PRELOAD_LINE = 'preload = ["./noctenium/toolbox-preload-bridge.js"]';

// any version of our own preload block, marker comment optional (old installs used a different
// one). anyone else's preload is left alone
const OUR_LINE = '^[ \\t]*preload[ \\t]*=[ \\t]*\\[[^\\r\\n]*toolbox-preload-bridge\\.js[^\\r\\n]*\\][ \\t]*\\r?\\n?';
const WITH_MARKER = '^[ \\t]*#[^\\r\\n]*(?:noctenium|toolbox-stock-noctenium)[^\\r\\n]*\\r?\\n' + OUR_LINE;

// errors we get when the game still has the addon loaded
const LOCKED = new Set(['EBUSY', 'EPERM', 'EACCES']);

const fail = (reason, extra) => ({ ok: false, reason, ...extra });

function read(file) {
    const text = fs.readFileSync(file, 'utf8');
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function sha256(file) {
    if (!fs.existsSync(file)) return null;
    const hash = crypto.createHash('sha256');
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.allocUnsafe(1 << 20);
    try {
        for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0;) hash.update(buf.subarray(0, n));
    } finally {
        fs.closeSync(fd);
    }
    return hash.digest('hex');
}

function sameFile(a, b) {
    return fs.existsSync(b) && sha256(a) === sha256(b);
}

// writes only when the content differs, true if it did
function writeIfChanged(file, text) {
    if (fs.existsSync(file) && read(file) === text) return false;
    fs.writeFileSync(file, text);
    return true;
}

function stripOurBlock(text) {
    text = text.replace(new RegExp(WITH_MARKER, 'gm'), '');
    text = text.replace(new RegExp(OUR_LINE, 'gm'), '');
    text = text.replace(/(\r?\n){3,}/g, '\r\n\r\n');
    return text.replace(/^[\r\n]+/, '');
}

function paths(gameBinaries) {
    const noctDir = path.join(gameBinaries, 'noctenium');
    return {
        noctDir,
        bunfig: path.join(gameBinaries, 'bunfig.toml'),
        addon: path.join(noctDir, 'toolbox-preload-bridge.node'),
        stub: path.join(noctDir, 'toolbox-preload-bridge.js'),
        oldWorker: path.join(noctDir, 'toolbox-preload-worker.js'),
        config: path.join(noctDir, 'toolbox-preload-config.json'),
        enabled: path.join(noctDir, 'toolbox-preload-bridge.enabled'),
        state: path.join(noctDir, '.elixir-bridge-state.json'),
        log: path.join(noctDir, 'logs', 'toolbox-preload-bridge.log'),
        dinput: path.join(gameBinaries, 'DINPUT8.dll'),
        noctenium: path.join(gameBinaries, 'noctenium.exe'),
        hotBridge: path.join(noctDir, 'native', 'noctenium_hot_bridge.node')
    };
}

function install({ toolboxRoot, gameBinaries }) {
    try {
        toolboxRoot = path.resolve(toolboxRoot);
        gameBinaries = path.resolve(gameBinaries);
        const p = paths(gameBinaries);
        const payload = path.join(toolboxRoot, 'bridge', 'game-preload');
        const srcAddon = path.join(payload, 'toolbox-preload-bridge.node');
        const srcStub = path.join(payload, 'toolbox-preload-bridge.js');

        const tbConfig = path.join(toolboxRoot, 'config.json');
        if (!fs.existsSync(tbConfig)) return fail('no-config');
        for (const [file, label] of [
            [p.noctenium, 'noctenium.exe'],
            [p.dinput, 'DINPUT8.dll'],
            [p.hotBridge, 'noctenium_hot_bridge.node']
        ])
            if (!fs.existsSync(file)) return fail('missing-game-file', { file: label });
        if (!fs.existsSync(srcAddon) || !fs.existsSync(srcStub)) return fail('missing-payload');

        // the bridge settings come straight from our own config
        const nox = JSON.parse(read(tbConfig)).noctenium;
        if (!nox || !nox.token) return fail('no-token');
        const ipcPort = nox.ipcPort ? parseInt(nox.ipcPort, 10) : 9260;
        const packetTimeoutMs = nox.packetTimeoutMs ? parseInt(nox.packetTimeoutMs, 10) : 100;
        const activationTimeoutMs = nox.activationTimeoutMs ? parseInt(nox.activationTimeoutMs, 10) : 1000;

        // refuse only if bunfig has a preload that is not ours
        const bunfigText = fs.existsSync(p.bunfig) ? read(p.bunfig) : '';
        const withoutOurs = stripOurBlock(bunfigText);
        if (/^[ \t]*preload[ \t]*=/m.test(withoutOurs)) return fail('foreign-preload');

        fs.mkdirSync(p.noctDir, { recursive: true });
        let changed = false;

        // addon first, it is the one file a running game holds open. stop before touching
        // anything else if we can't replace it
        if (!sameFile(srcAddon, p.addon)) {
            try {
                fs.copyFileSync(srcAddon, p.addon);
            } catch (e) {
                if (LOCKED.has(e.code)) return fail('locked');
                throw e;
            }
            changed = true;
        }
        if (!sameFile(srcStub, p.stub)) {
            fs.copyFileSync(srcStub, p.stub);
            changed = true;
        }
        // the old js bridge had a worker, the addon doesn't
        if (fs.existsSync(p.oldWorker)) {
            fs.rmSync(p.oldWorker, { force: true });
            changed = true;
        }

        const config = {
            host: '127.0.0.1',
            port: ipcPort,
            token: String(nox.token),
            packetTimeoutMs,
            activationTimeoutMs
        };
        changed = writeIfChanged(p.config, JSON.stringify(config)) || changed;
        changed = writeIfChanged(p.enabled, 'enabled') || changed;

        // drop any old copy of our block, then write one fresh copy
        const block = `${MARKER}\r\n${PRELOAD_LINE}\r\n`;
        const bunfigNext = withoutOurs.trim().length > 0 ? `${withoutOurs.trimEnd()}\r\n\r\n${block}` : block;
        changed = writeIfChanged(p.bunfig, bunfigNext) || changed;

        // the native hashes are audit only, so skip the (big) hashing when nothing changed
        if (changed || !fs.existsSync(p.state)) {
            const state = {
                installedAt: new Date().toISOString(),
                toolboxRoot,
                ipcPort,
                packetTimeoutMs,
                activationTimeoutMs,
                nativeAudit: {
                    dinput8Sha256: sha256(p.dinput),
                    nocteniumSha256: sha256(p.noctenium),
                    hotBridgeAddonSha256: sha256(p.hotBridge)
                }
            };
            fs.writeFileSync(p.state, JSON.stringify(state, null, 2));
        }
        return { ok: true, changed };
    } catch (e) {
        return fail('error', { error: e.message });
    }
}

function uninstall({ gameBinaries, toolboxRoot }) {
    try {
        const p = paths(path.resolve(gameBinaries));

        // addon first, same reason as install
        try {
            fs.rmSync(p.addon, { force: true });
        } catch (e) {
            if (LOCKED.has(e.code)) return fail('locked');
            throw e;
        }

        if (fs.existsSync(p.bunfig)) {
            const text = read(p.bunfig);
            const clean = stripOurBlock(text);
            if (clean.trim().length === 0) fs.rmSync(p.bunfig, { force: true });
            else if (clean !== text) fs.writeFileSync(p.bunfig, `${clean.trimEnd()}\r\n`);
        }

        for (const file of [p.stub, p.oldWorker, p.config, p.enabled, p.state, p.log]) fs.rmSync(file, { force: true });

        // leftovers from the standalone-repo installer
        if (toolboxRoot)
            fs.rmSync(path.join(toolboxRoot, '_noctenium-preload-bridge-state'), { recursive: true, force: true });
        return { ok: true };
    } catch (e) {
        return fail('error', { error: e.message });
    }
}

// just the marker, the game reads it at startup
function enable({ gameBinaries }) {
    const p = paths(path.resolve(gameBinaries));
    if (!fs.existsSync(p.stub)) return fail('not-installed');
    fs.writeFileSync(p.enabled, 'enabled');
    return { ok: true };
}

function disable({ gameBinaries }) {
    fs.rmSync(paths(path.resolve(gameBinaries)).enabled, { force: true });
    return { ok: true };
}

function status({ gameBinaries }) {
    const p = paths(path.resolve(gameBinaries));
    let state = null;
    try {
        state = JSON.parse(read(p.state));
    } catch (_) {
        // not installed
    }
    let bunfigPreload = false;
    try {
        bunfigPreload = /toolbox-preload-bridge\.js/.test(read(p.bunfig));
    } catch (_) {
        // no bunfig
    }
    return {
        installed: fs.existsSync(p.stub) && fs.existsSync(p.addon),
        enabled: fs.existsSync(p.enabled),
        bunfigPreload,
        state,
        nativeHashes: { dinput8: sha256(p.dinput), noctenium: sha256(p.noctenium), hotBridge: sha256(p.hotBridge) }
    };
}

// the en.js key and tokens for a result, so both loaders say the same thing
function explain(action, result) {
    if (result.ok) return { key: `noctenium/${action}-success` };
    if (result.reason === 'error') return { key: `noctenium/${action}-error`, tokens: { error: result.error } };
    return { key: `noctenium/${action}-error-${result.reason}`, tokens: { file: result.file } };
}

module.exports = { install, uninstall, enable, disable, status, explain };
