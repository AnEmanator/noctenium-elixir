/* Copyright (C) 2026 AnEmanator. All Rights Reserved. */

'use strict';
const EventEmitter = require('events');
const { Connection } = require('@anemanator/network-proxy');

class ToolboxPreloadConnection {
    constructor({ metadata, clientInterfaceConnection, bridgeTransport, modManager, log }) {
        this.metadata = metadata;
        this.clientInterfaceConnection = clientInterfaceConnection;
        this.bridgeTransport = bridgeTransport;
        this.modManager = modManager;
        this.log = log;
        this.modsStarted = false;
        this.closed = false;

        // noIntegrity=true: stock Noctenium remains the sole owner of game-session
        // integrity/encryption/native injection. we only run Dispatch/mods.
        this.inner = new Connection(metadata, clientInterfaceConnection, true);
        this.dispatch = this.inner.dispatch;
        this.inner.sendServer = data => this.sendServer(data);
        this.inner.sendClient = data => this.sendClient(data);

        this.inner.serverConnection = new EventEmitter();
        this.inner.serverConnection.remoteAddress = metadata.serverIp || '127.0.0.20';
        this.inner.serverConnection.remotePort = metadata.serverPort || 0;
        this.inner.serverConnection.destroyed = false;
    }

    sendServer(packet) {
        return this.bridgeTransport.inject(1, Buffer.from(packet));
    }
    sendClient(packet) {
        return this.bridgeTransport.inject(0, Buffer.from(packet));
    }

    startMods() {
        if (this.closed || this.modsStarted || !this.dispatch) return;
        this.modsStarted = true;

        // Client mods are process/client-interface scoped and are loaded at TCI
        // `info`, matching regular Toolbox.  Network session activation owns only
        // the network instances.
        this.modManager.loadAllNetwork(this.dispatch);
        try {
            this.inner.serverConnection.emit('connect');
        } catch (_) {}
    }

    updateMetadata(meta) {
        Object.assign(this.metadata, meta || {});
        if (this.inner && this.inner.metadata) Object.assign(this.inner.metadata, meta || {});
        if (this.inner?.serverConnection) {
            this.inner.serverConnection.remoteAddress =
                this.metadata.serverIp || this.inner.serverConnection.remoteAddress;
            this.inner.serverConnection.remotePort = this.metadata.serverPort || this.inner.serverConnection.remotePort;
        }
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        if (this.modsStarted) {
            try {
                this.modManager.unloadAllNetwork(this.dispatch);
            } catch (e) {
                this.log('error-bridge', { error: e.message });
            }
            try {
                this.inner?.serverConnection?.emit('close');
            } catch (_) {}
        }
        this.modsStarted = false;
        try {
            if (this.dispatch?.destructor) this.dispatch.destructor();
        } catch (_) {}
        if (this.inner) this.inner.dispatch = null;
        this.dispatch = null;
        this.inner = null;
    }
}
module.exports = ToolboxPreloadConnection;
