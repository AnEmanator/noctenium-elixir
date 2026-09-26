/* Copyright (C) 2026 AnEmanator. All Rights Reserved. */

'use strict';
const BRIDGE_VERSION = '0.9.0';
const EventEmitter = require('events');
const fs = require('fs');
const net = require('net');
const path = require('path');
const mui = require('@anemanator/toolbox-mui').DefaultInstance;
const {
    TYPE,
    RESULT,
    Peer,
    parseJson,
    decodePacket,
    encodePacketResult,
    encodeAsyncInject
} = require('./ipc-protocol');
const ClientFacade = require('./client-interface');
const ToolboxPreloadConnection = require('./toolbox-connection');

function publisherFromLanguage(language) {
    switch (String(language || '').toUpperCase()) {
        case 'EUR':
        case 'FRA':
        case 'GER':
        case 'RUS':
            return 'gf';
        case 'KOR':
            return 'bh';
        case 'JPN':
            return 'pm';
        case 'TW':
            return 'm5';
        default:
            return 'gf';
    }
}

function normalizeClientInfo(data) {
    const info = { ...(data || {}) };
    if (typeof info.language === 'string') info.language = info.language.toLowerCase();
    if (!info.publisher) info.publisher = publisherFromLanguage(data && data.language);
    if (!info.platform) info.platform = 'pc';
    if (!info.environment) info.environment = 'live';
    delete info.just_started;
    return info;
}

function readJsonFile(file) {
    let text = fs.readFileSync(file, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return JSON.parse(text);
}
function loadProtocolMap(toolboxRoot, gameRoot, version, supplied, log) {
    const result = {};
    let parseMap = null;
    try {
        parseMap = require('@anemanator/data-parser').parsers.Map;
    } catch (e) {
        log('error-bridge-map', { error: e.message });
    }
    if (parseMap) {
        for (const p of [
            path.join(toolboxRoot, 'data', 'opcodes', `protocol.${version}.map`),
            path.join(gameRoot, 'data', 'opcodes', `protocol.${version}.map`)
        ]) {
            try {
                if (fs.existsSync(p)) Object.assign(result, parseMap(p));
            } catch (e) {
                log('error-bridge-map', { error: `${path.basename(p)}: ${e.message}` });
            }
        }
    }
    try {
        const data = readJsonFile(path.join(toolboxRoot, 'data', 'data.json'));
        if (data?.maps?.[version]) Object.assign(result, data.maps[version]);
    } catch (_) {}
    Object.assign(result, supplied || {});
    return result;
}
function hooksSignature(dispatch) {
    if (!dispatch?.hooks) return { sig: '', wildcard: false, codes: [] };
    let wildcard = false;
    const codes = [];
    for (const [code, groups] of dispatch.hooks.entries()) {
        const live =
            Array.isArray(groups) &&
            groups.some(g => Array.isArray(g.hooks) && g.hooks.some(h => h && h.__nocteniumDisabled !== true));
        if (!live) continue;
        if (code === '*') wildcard = true;
        else if (typeof code === 'number' && code >= 0 && code < 65536) codes.push(code);
    }
    codes.sort((a, b) => a - b);
    return { sig: `${wildcard ? 1 : 0}:${codes.join(',')}`, wildcard, codes };
}

class IpcTransport {
    constructor(host) {
        this.host = host;
        this.activeContext = null;
    }
    inject(direction, packet) {
        packet = Buffer.from(packet);
        if (this.activeContext) {
            this.activeContext.effects.push({ direction, data: packet });
            return true;
        }
        if (!this.host.peer) return false;
        return this.host.peer.send(TYPE.AsyncInject, 0, encodeAsyncInject(direction, packet));
    }
}

class StockNocteniumPreloadProxy extends EventEmitter {
    constructor(modFolder, dataFolder, config) {
        super();
        this.modFolder = modFolder;
        this.dataFolder = dataFolder;
        this.config = config || {};
        this.nox = this.config.noctenium || {};
        this.toolboxRoot = path.resolve(__dirname, '..', '..');
        this.status = 'stopped';
        this.server = null;
        this.peer = null;
        this.modManager = null;
        this.connection = null;
        this.clientInterface = null;
        this.transport = new IpcTransport(this);
        this.running = false;
        this.authenticated = false;
        this.sessionPrepared = false;
        this.sessionActive = false;
        this.lastInterceptSig = '';
        this.interceptTimer = null;
        // Real client interface (DataCenter / TCI). Process-lived, survives sessions.
        this.ciServer = null;
        this.ciConn = null;
        this.ciInfo = null;
        this.ciReadyData = null;
        this.ciDcReady = false;
        this.ciInstallInFlight = null;
    }

    log(key, tokens) {
        console.log(mui.get(`noctenium/${key}`, tokens));
    }

    _setStatus(status) {
        if (this.status === status) return;
        this.status = status;
        this.emit('status', status);
    }

    // Resolves once the IPC server is listening; rejects if the port can't be bound.
    run() {
        if (this.running) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const ModManager = require('../mod-manager.js');
            this.modManager = new ModManager(this.modFolder);
            this.modManager.loadAll();

            // Keep one client-interface identity for the lifetime of the game
            // client. Regular Toolbox keys ClientMod instances by this identity.
            if (!this.clientInterface) this.clientInterface = new ClientFacade({}, this.log.bind(this));

            this.startClientInterface();
            const host = '127.0.0.1';
            const port = Number(this.nox.ipcPort || 9260);
            this.server = net.createServer(socket => this.accept(socket));
            this.server.on('error', e => {
                // bind failures are reported by the loader through the rejection
                if (e.code === 'EADDRINUSE' || e.code === 'EADDRNOTAVAIL') {
                    this._setStatus('fail');
                    if (!this.running) reject(e);
                    return;
                }
                this.log('error-ipc', { error: e.message });
            });
            this.server.listen(port, host, () => {
                this.running = true;
                this._setStatus('pending');
                this.log('started');
                resolve();
            });
        });
    }

    // Run Toolbox's own tera-client-interface server. It opens its own TCP listener and
    // injects tera-client-interface-*.dll into the game exe; the DLL connects back and serves
    // DataCenter queries. Orthogonal to the packet stream, so it coexists with Noctenium.
    // Any failure here is non-fatal: the facade just stays a soft stub.
    startClientInterface() {
        if (this.nox.clientInterface === false) return;
        let CI;
        try {
            CI = require('@anemanator/client-interface');
        } catch (e) {
            this.log('error-client-interface-start', { error: e.message });
            return;
        }
        try {
            this.ciServer = new CI(
                false,
                '127.0.0.10',
                9250,
                conn => this._onCiConnect(conn),
                () => {},
                e => this._onCiError(e)
            );
            this.ciServer.run();
        } catch (e) {
            this.log('error-client-interface-start', { error: e.message });
            try {
                if (this.ciServer) this.ciServer.destructor();
            } catch (_) {}
            this.ciServer = null;
        }
    }

    _onCiError(e) {
        this.log('error-client-interface-start', { error: e.code || e.message });
        if (e.code === 'EADDRINUSE' || e.code === 'EADDRNOTAVAIL') {
            try {
                if (this.ciServer) this.ciServer.destructor();
            } catch (_) {}
            this.ciServer = null;
        }
    }

    _onCiConnect(conn) {
        if (this.ciConn && this.ciConn !== conn && this.clientInterface) {
            try {
                this.clientInterface.detachReal();
            } catch (_) {}
        }

        this.ciConn = conn;
        this.ciDcReady = false;
        this.ciReadyData = null;

        conn.on('data', (command, data) => {
            try {
                if (command === 'info') {
                    const justStarted = !!(data && data.just_started);

                    // Preserve the existing Classic+ patch-version compatibility workaround.
                    if (data && data.error && String(data.error).includes('patch version')) {
                        data = { ...data, majorPatchVersion: 100, minorPatchVersion: 2 };
                        delete data.error;
                    }

                    if (data && data.error) {
                        this.log('error-client-interface', { error: data.error });
                        if (justStarted) {
                            try {
                                conn.resume();
                            } catch (_) {}
                        }
                        return;
                    }

                    const info = normalizeClientInfo(data);
                    conn.info = info;
                    this.ciInfo = info;

                    if (!this.clientInterface) this.clientInterface = new ClientFacade({}, this.log.bind(this));

                    this.clientInterface.updateInfo(info);
                    this.clientInterface.attachReal(conn);

                    // This is the normal Toolbox client-mod lifecycle trigger.  It is
                    // intentionally independent of SessionStart / HotBridge activation.
                    if (!this.clientInterface._modsLoaded) {
                        this.modManager.loadAllClient(this.clientInterface);
                        this.clientInterface.notifyModsLoaded();
                    }

                    // `just_started` does NOT gate loadAllClient in regular Toolbox.  It
                    // gates the file-based GPK/DLL installation pass while the game is still
                    // in the startup window.
                    if (justStarted && !this.ciInstallInFlight) {
                        const ci = this.clientInterface;
                        this.ciInstallInFlight = Promise.resolve()
                            .then(async () => {
                                if (!ci.real)
                                    throw new Error('client interface disconnected before client-mod install');

                                if (!ci.GPKManager || typeof ci.GPKManager.initialize !== 'function')
                                    throw new Error('GPKManager unavailable on live tera-client-interface');

                                ci.GPKManager.initialize(path.join(info.path, '..'));
                                await this.modManager._installAllClient(ci);
                                ci._installGPKs();
                            })
                            .catch(e => {
                                this.log('error-client-interface', { error: e.message });
                                try {
                                    ci.resume();
                                } catch (_) {}
                            })
                            .finally(() => {
                                this.ciInstallInFlight = null;
                            });
                    }
                } else if (command === 'installgpksresult') {
                    if (!data || data.success !== true)
                        this.log('error-client-interface', {
                            error: data && data.error ? data.error : 'unknown error'
                        });
                    try {
                        conn.resume();
                    } catch (_) {}
                } else if (command === 'ready') {
                    this.ciDcReady = true;
                    this.ciReadyData = data;
                    if (this.clientInterface) this.clientInterface.notifyRealReady(data);
                } else if (command === 'get_sls') {
                    // Noctenium owns the native SLS redirect; just unblock the Toolbox DLL.
                    conn.send('sls', data);
                }
            } catch (e) {
                this.log('error-client-interface', { error: e.message });
            }
        });

        conn.on('disconnect', () => {
            if (this.ciConn !== conn) return;

            this.ciConn = null;
            this.ciInfo = null;
            this.ciReadyData = null;
            this.ciDcReady = false;
            this.ciInstallInFlight = null;

            if (this.clientInterface) {
                try {
                    if (this.clientInterface._modsLoaded) this.modManager.unloadAllClient(this.clientInterface);
                } catch (e) {
                    this.log('error-client-interface', { error: e.message });
                }

                try {
                    this.clientInterface.notifyModsUnloaded();
                } catch (_) {}
                try {
                    this.clientInterface.notifyDisconnect();
                } catch (_) {}
            }
        });

        if (this.clientInterface) this.clientInterface.attachReal(conn);

        this.log('client-interface-connected');
    }

    accept(socket) {
        socket.setNoDelay(true);
        if (this.peer) {
            try {
                this.peer.close();
            } catch (_) {}
        }
        const peer = new Peer(socket);
        this.peer = peer;
        this.authenticated = false;
        peer.on('frame', f => this.onFrame(peer, f));
        peer.on('error', e => this.log('error-bridge', { error: e.message }));
        peer.on('close', () => {
            if (peer.authTimer) {
                clearTimeout(peer.authTimer);
                peer.authTimer = null;
            }
            if (this.peer === peer) {
                this.endSession('preload-disconnect');
                this.peer = null;
                this.authenticated = false;
                if (this.running) this._setStatus('pending');
            }
        });
    }

    onFrame(peer, frame) {
        try {
            if (frame.type === TYPE.Hello) {
                const hello = parseJson(frame.payload);
                const bridgeAuth = require('./bridge-auth');
                if (!bridgeAuth.available()) {
                    peer.sendJson(TYPE.HelloAck, 0, { ok: false });
                    this.log('error-bridge-library');
                    peer.close();
                    return;
                }
                // prove ourselves to the game (build secret + our update server), keyed by the token
                const begun = this.nox.token ? bridgeAuth.begin(this.nox.token, hello.nonce) : null;
                if (!begun) {
                    peer.sendJson(TYPE.HelloAck, 0, { ok: false });
                    this.log('error-bridge-auth');
                    peer.close();
                    return;
                }
                peer.nonceC = hello.nonce;
                peer.nonceH = begun.nonce;
                peer.sendJson(TYPE.HelloAck, 0, {
                    ok: true,
                    nonce: begun.nonce,
                    proof: begun.proof,
                    bridgeVersion: BRIDGE_VERSION,
                    pid: process.pid,
                    electron: process.versions.electron,
                    node: process.versions.node
                });
                // the game must prove itself back within 5s or we drop it
                peer.authTimer = setTimeout(() => {
                    if (this.peer === peer && !this.authenticated) {
                        this.log('error-bridge-auth');
                        peer.close();
                    }
                }, 5000);
                return;
            }
            if (frame.type === TYPE.Auth) {
                const bridgeAuth = require('./bridge-auth');
                const ok = bridgeAuth.verify(this.nox.token, peer.nonceC, peer.nonceH, parseJson(frame.payload).proof);
                if (peer.authTimer) {
                    clearTimeout(peer.authTimer);
                    peer.authTimer = null;
                }
                peer.sendJson(TYPE.AuthAck, 0, { ok });
                if (!ok) {
                    this.log('error-bridge-auth');
                    peer.close();
                    return;
                }
                this.authenticated = true;
                this._setStatus('ok');
                this.log('bridge-connected');
                return;
            }
            if (!this.authenticated) return;

            if (frame.type === TYPE.SessionStart) {
                const s = parseJson(frame.payload);
                if (!this.sessionPrepared) this.prepareSession(s);
                else this.updateSessionMetadata(s);

                // The preload polls stock connection metadata before the first bridged
                // packet. Once the real server endpoint is visible we can attach
                // Electron network mods ahead of C_LOGIN_ARBITER instead of making the
                // first packet pay module construction cost.
                if (!this.sessionActive && s.networkReady === true)
                    this.activateSession(0, 'stock connection metadata ready');

                peer.sendJson(TYPE.SessionReady, 0, {
                    ok: true,
                    prepared: this.sessionPrepared,
                    active: this.sessionActive
                });
                return;
            }
            if (frame.type === TYPE.SessionEnd) {
                this.endSession(parseJson(frame.payload).reason || 'session-end');
                return;
            }
            if (frame.type === TYPE.Packet) {
                this.handlePacket(frame);
                return;
            }
        } catch (e) {
            this.log('error-bridge', { error: e.message });
            if (frame.type === TYPE.Packet) {
                peer.send(TYPE.PacketResult, frame.requestId, encodePacketResult(RESULT.Pass, null, []));
            }
        }
    }

    prepareSession(s) {
        this.endSession('prepare-new');
        const protocolVersion = Number(s.protocolVersion || 0);
        const protocol = loadProtocolMap(
            this.toolboxRoot,
            s.gameRoot,
            protocolVersion,
            s.protocol,
            this.log.bind(this)
        );
        const metadata = {
            dataFolder: this.dataFolder,
            serverId: Number(s.serverId || 0),
            serverList: s.serverList || {},
            platform: s.platform || 'pc',
            publisher: s.publisher || 'gf',
            environment: s.environment || 'live',
            language: s.language || 'eur',
            majorPatchVersion: Number(s.majorPatchVersion || 100),
            minorPatchVersion: Number(s.minorPatchVersion || 2),
            protocolVersion,
            maps: { protocol, sysmsg: s.sysmsg || {} },
            serverIp: s.serverIp || '',
            serverPort: Number(s.serverPort || 0)
        };
        if (!this.clientInterface) this.clientInterface = new ClientFacade({}, this.log.bind(this));
        this.clientInterface.updateInfo({ ...metadata, pid: Number(s.gamePid || this.clientInterface.info.pid || 0) });
        if (this.ciConn) this.clientInterface.attachReal(this.ciConn);

        this.connection = new ToolboxPreloadConnection({
            metadata,
            clientInterfaceConnection: this.clientInterface,
            bridgeTransport: this.transport,
            modManager: this.modManager,
            log: this.log.bind(this)
        });
        this.sessionPrepared = true;
        this.sessionActive = false;
        this.lastInterceptSig = '';
    }

    updateSessionMetadata(s) {
        if (!this.connection) return;
        this.connection.updateMetadata({
            serverId: Number(s.serverId || this.connection.metadata.serverId || 0),
            serverIp: s.serverIp || this.connection.metadata.serverIp || '',
            serverPort: Number(s.serverPort || this.connection.metadata.serverPort || 0),
            serverList: s.serverList || this.connection.metadata.serverList || {},
            language: s.language || this.connection.metadata.language,
            platform: s.platform || this.connection.metadata.platform,
            publisher: s.publisher || this.connection.metadata.publisher,
            environment: s.environment || this.connection.metadata.environment
        });
    }

    activateSession(connId, reason = 'first intercepted stock HotBridge packet') {
        if (!this.connection || !this.sessionPrepared) return false;
        if (!this.sessionActive) {
            this.connection.startMods();
            this.sessionActive = true;
            this.refreshIntercepts(true);
            if (!this.interceptTimer) this.interceptTimer = setInterval(() => this.refreshIntercepts(false), 250);
        }
        return true;
    }

    refreshIntercepts(force) {
        if (!this.peer || !this.connection?.dispatch || !this.sessionActive) return;
        const state = hooksSignature(this.connection.dispatch);
        if (!force && state.sig === this.lastInterceptSig) return;
        this.lastInterceptSig = state.sig;
        this.peer.sendJson(TYPE.Intercepts, 0, { wildcard: state.wildcard, codes: state.codes });
    }

    handlePacket(frame) {
        const p = decodePacket(frame.payload);
        if (!this.connection?.dispatch) {
            this.peer.send(TYPE.PacketResult, frame.requestId, encodePacketResult(RESULT.Pass, null, []));
            return;
        }
        if (!this.sessionActive && !this.activateSession(p.connId, 'first bridged packet')) {
            this.peer.send(TYPE.PacketResult, frame.requestId, encodePacketResult(RESULT.Pass, null, []));
            return;
        }

        const original = Buffer.from(p.packet);
        const ctx = { effects: [] };
        this.transport.activeContext = ctx;
        let result = RESULT.Pass,
            modified = null;
        try {
            const handled = this.connection.dispatch.handle(Buffer.from(original), p.direction === 0);
            if (handled === false) result = RESULT.Silenced;
            else if (Buffer.isBuffer(handled) && !handled.equals(original)) {
                result = RESULT.Modified;
                modified = handled;
            }
        } catch (e) {
            this.log('error-bridge', { error: `op=0x${p.opcode.toString(16)}: ${e.message}` });
            result = RESULT.Pass;
            modified = null;
            ctx.effects.length = 0;
        } finally {
            this.transport.activeContext = null;
        }

        this.peer.send(TYPE.PacketResult, frame.requestId, encodePacketResult(result, modified, ctx.effects));
    }

    endSession(reason) {
        if (this.interceptTimer) {
            clearInterval(this.interceptTimer);
            this.interceptTimer = null;
        }
        if (this.peer && this.authenticated && this.lastInterceptSig)
            this.peer.sendJson(TYPE.Intercepts, 0, { wildcard: false, codes: [] });
        if (this.connection) {
            try {
                this.connection.close();
            } catch (_) {}
        }
        this.connection = null;
        this.sessionPrepared = false;
        this.sessionActive = false;
        this.lastInterceptSig = '';
        this.transport.activeContext = null;
    }

    destructor() {
        this._setStatus('stopped');
        this.endSession('proxy-stop');

        if (this.clientInterface && this.modManager) {
            try {
                if (this.clientInterface._modsLoaded) this.modManager.unloadAllClient(this.clientInterface);
            } catch (_) {}
            try {
                this.clientInterface.notifyModsUnloaded();
            } catch (_) {}
            try {
                this.clientInterface.close();
            } catch (_) {}
        }
        this.clientInterface = null;

        if (this.ciServer) {
            try {
                this.ciServer.destructor();
            } catch (_) {}
            this.ciServer = null;
        }
        this.ciConn = null;
        this.ciInfo = null;
        this.ciReadyData = null;
        this.ciDcReady = false;
        this.ciInstallInFlight = null;
        if (this.modManager) {
            try {
                this.modManager.destructor();
            } catch (_) {}
            this.modManager = null;
        }
        if (this.peer) {
            try {
                this.peer.close();
            } catch (_) {}
            this.peer = null;
        }
        if (this.server) {
            try {
                this.server.close();
            } catch (_) {}
            this.server = null;
        }
        this.running = false;
    }
    get hasActiveConnections() {
        return !!this.connection && this.sessionActive;
    }
}
module.exports = StockNocteniumPreloadProxy;
module.exports.BRIDGE_VERSION = BRIDGE_VERSION;
