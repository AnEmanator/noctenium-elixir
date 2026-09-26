/* Copyright (C) 2026 AnEmanator. All Rights Reserved. */

'use strict';
const EventEmitter = require('events');

// Process-lived client-interface identity object.
//
// Client mod instances are keyed by object identity in Toolbox.  Keep this facade
// stable across the later Noctenium network-session prepare/activate lifecycle,
// while delegating the full public tera-client-interface surface to the real
// injected Toolbox client connection as soon as it appears.
const MERGE_INFO_KEYS = [
    'pid',
    'arch',
    'path',
    'publisher',
    'platform',
    'environment',
    'majorPatchVersion',
    'minorPatchVersion',
    'protocolVersion',
    'sysmsgVersion',
    'sysmsg',
    'protocol'
];

class StockClientInterfaceFacade extends EventEmitter {
    constructor(info, log = () => {}) {
        super();
        this.info = info || {};
        this.log = log;
        this.proxyServers = new Map();

        this.real = null;
        this._realReady = false;
        this._modsLoaded = false;
        this._readyEmitted = false;
    }

    updateInfo(info) {
        this._mergeInfo(info);
    }

    _mergeInfo(src) {
        if (!src) return;

        for (const k of MERGE_INFO_KEYS) {
            if (src[k] !== undefined && src[k] !== null) this.info[k] = src[k];
        }

        if (typeof src.language === 'string') this.info.language = src.language.toLowerCase();
    }

    attachReal(conn) {
        if (this.real !== conn) this._readyEmitted = false;

        this.real = conn || null;
        if (conn && conn.info) this._mergeInfo(conn.info);
    }

    detachReal() {
        this.real = null;
        this._realReady = false;
        this._readyEmitted = false;
    }

    notifyModsLoaded() {
        this._modsLoaded = true;
        this._trySignalReady();
    }

    notifyModsUnloaded() {
        this._modsLoaded = false;
        this._readyEmitted = false;
    }

    notifyRealReady(readyData) {
        this._mergeInfo(readyData);
        this._realReady = true;

        // Match the useful public client-interface lifecycle surfaces.  Some client
        // mods listen to the raw data event while others wait for "ready".
        this.emit('data', 'ready', readyData);
        this._trySignalReady();
    }

    notifyDisconnect() {
        this.detachReal();
        this.emit('disconnect');
    }

    _trySignalReady() {
        if (this._readyEmitted || !this.real || !this._realReady || !this._modsLoaded) return;

        this._readyEmitted = true;
        this.emit('ready');
    }

    // true == DataCenter queries will actually work right now
    get available() {
        return !!this.real && this._realReady;
    }

    // Public tera-client-interface/GPK surfaces.  These are deliberately delegated
    // instead of reimplemented so the normal Toolbox client-mod installer can run.
    get GPKManager() {
        return this.real ? this.real.GPKManager : null;
    }

    queryData(...args) {
        return this.real ? this.real.queryData(...args) : Promise.reject(new Error('client interface not connected'));
    }

    hasFocus() {
        return this.real ? this.real.hasFocus() : Promise.resolve(false);
    }

    send(...args) {
        return this.real ? this.real.send(...args) : false;
    }

    suspend(...args) {
        return this.real && typeof this.real.suspend === 'function' ? this.real.suspend(...args) : false;
    }

    resume(...args) {
        return this.real ? this.real.resume(...args) : false;
    }

    configureCameraShake(...args) {
        return this.real ? this.real.configureCameraShake(...args) : false;
    }

    flashWindow(...args) {
        return this.real ? this.real.flashWindow(...args) : false;
    }

    installGPK(...args) {
        if (!this.real || typeof this.real.installGPK !== 'function')
            throw new Error('client interface installGPK unavailable');
        return this.real.installGPK(...args);
    }

    injectDLL(...args) {
        if (!this.real || typeof this.real.injectDLL !== 'function')
            throw new Error('client interface injectDLL unavailable');
        return this.real.injectDLL(...args);
    }

    _installGPKs(...args) {
        if (!this.real || typeof this.real._installGPKs !== 'function')
            throw new Error('client interface _installGPKs unavailable');
        return this.real._installGPKs(...args);
    }

    close() {
        this.notifyDisconnect();
    }
}

module.exports = StockClientInterfaceFacade;
