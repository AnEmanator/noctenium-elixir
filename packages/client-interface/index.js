const mui = require('@anemanator/toolbox-mui').DefaultInstance;
const net = require('net');
const path = require('path');
const EventEmitter = require('events');
const GPKManager = require('./GPKManager');

class ClientInterfaceConnection extends EventEmitter {
    constructor(socket, GPKManager) {
        super();
        this.setMaxListeners(0);

        this.socket = socket;
        this.buffer = null;
        this.pending = [];

        this.dataQueryEventEmitter = new EventEmitter;
        this.nextDataQueryId = 0;

        this.GPKManager = GPKManager;

        this.socket.on('data', data => {
            if (!this.socket)
                return;

            // no delimiter yet, hold the chunk. joining every time re-copies everything received so far
            if (data.indexOf(0) < 0) {
                this.pending.push(data);
                return;
            }

            this.buffer = Buffer.concat(this.buffer ? [this.buffer, ...this.pending, data] : [...this.pending, data]);
            this.pending = [];

            let start = 0;
            let end = -1;
            while ((end = this.buffer.indexOf(0, start)) >= 0) {
                if (end > start) {
                    const packet = this.buffer.slice(start, end);
                    try {
                        const parsed = JSON.parse(packet);

                        switch (parsed.command) {
                            case 'dcresult':
                                this.dataQueryEventEmitter.emit(parsed.data.id.toString(), parsed.data);
                                break;
                            case 'ready':
                                this.emit('data', parsed.command, parsed.data || {});
                                this.emit('ready');
                                break;
                            case 'hasfocus':
                                this.emit('hasfocus', parsed.data.result);
                                break;
                            default:
                                this.emit('data', parsed.command, parsed.data || {});
                                break;
                        }
                    } catch (e) {
                        console.log(mui.get('client-interface/index/communication-error'));
                        console.log(e);
                        // a real client never sends garbage, so drop it instead of eating endless parse errors
                        this.socket.destroy();
                        this.socket = null;
                        return;
                    }
                }

                start = end + 1;
            }

            this.buffer = this.buffer.slice(start);
        });

        this.socket.once('error', e => {
            this._onClose(e);
            this.socket = null;
        });

        this.socket.once('close', () => {
            this._onClose();
            this.socket = null;
        });
    }

    send(command, data = {}) {
        if (this.socket)
            this.socket.write(JSON.stringify({ command, data }) + "\x00");
    }

    _onClose(error) {
        this.emit('disconnect', error);
        this.removeAllListeners();

        if (this.GPKManager && this.info && this.info.path)
            this.GPKManager.uninstallAll(path.join(this.info.path, '..'));
        this.GPKManager = null;

        if (this.dataQueryEventEmitter) {
            this.dataQueryEventEmitter.removeAllListeners();
            this.dataQueryEventEmitter = null;
        }
    }

    destructor() {
        if (this.socket) {
            this.socket.end();
            this.socket.destroy();
            this.socket = null;
        } else {
            this._onClose();
        }
    }

    queryData(query, queryArgs = null, findAll = false, children = true, attributeFilter = null) {
        const queryId = this.nextDataQueryId++;

        const res = new Promise((resolve, reject) => {
            if (!this.dataQueryEventEmitter) {
                reject(new Error('Connection to client closed!'));
            } else {
                this.dataQueryEventEmitter.once(queryId.toString(), result => {
                    if (result.success)
                        resolve(result.data);
                    else
                        reject(result.error);
                });
            }
        });

        this.send('dcquery', {
            id: queryId,
            query: query,
            arguments: queryArgs,
            findall: findAll,
            children: children,
            attributeFilter: attributeFilter,
        });

        return res;
    }

    flashWindow(count = 5, interval = 0, allowFocused = false) {
        if (typeof (count) !== 'number')
            throw new Error('Count must be a number!');
        if (typeof (interval) !== 'number')
            throw new Error('Interval must be a number!');
        if (typeof (allowFocused) !== 'boolean')
            throw new Error('AllowFocused must be a boolean!');

        this.send('flashwindow', { count, interval, allowFocused });
    }

    hasFocus() {
        const res = new Promise((resolve, reject) => {
            this.once('hasfocus', result => {
                resolve(result);
            });
        });

        this.send('hasfocus');
        return res;
    }

    configureCameraShake(enabled, power = 1.0, speed = 1.0) {
        if (typeof (enabled) !== 'boolean')
            throw new Error('Enabled must be a boolean!');
        if (typeof (power) !== 'number')
            throw new Error('Power must be a number!');
        if (typeof (speed) !== 'number')
            throw new Error('Speed must be a number!');

        this.send('camerashake', { enabled, power, speed });
    }

    suspend() {
        this.send('suspend', {});
    }

    resume() {
        this.send('resume', {});
    }

    installGPK(fromPath, filename = null) {
        // basename both ways so a caller-supplied name can't traverse out of the GPK folder
        filename = path.basename(filename || fromPath);
        this.GPKManager.install(path.join(this.info.path, '..'), filename, fromPath, this.info.arch, this.info.majorPatchVersion, this.info.minorPatchVersion);
    }

    _installGPKs() {
        this.send('installgpks', { folder: this.GPKManager.GPKFolderName });
    }
}

class ClientInterfaceServer {
    constructor(isAdmin, host, port, onAccept, onReady, onError, verifyPeer) {
        this.host = host;
        this.port = port;
        this.onAccept = onAccept;
        // default on: only skip peer verification when a caller explicitly passes false
        this.verifyPeer = verifyPeer !== false;

        this.GPKManager = new GPKManager('_Toolbox');

        this.processListeners = new Set;
        this.connections = new Set;

        this.server = net.createServer(socket => this.accept(socket));
        this.server.on('listening', () => onReady());
        this.server.on('error', e => onError(e));

        if (process.platform === 'win32') {
            const scanner = require('./scanner');

            ['TERA.exe'].forEach(executable => this.processListeners.add(
                new scanner(executable, path.join(__dirname, 'client-interface-32.dll'), path.join(__dirname, 'client-interface-64.dll'), 25)
            ));
        }
    }

    destructor() {
        this.processListeners.forEach(processListener => processListener.stop());
        this.processListeners.clear();

        this.connections.forEach(connection => connection.destructor());
        this.connections.clear();

        this.server.close();
        this.server = null;

        if (this.GPKManager) {
            this.GPKManager.destructor();
            this.GPKManager = null;
        }

        this.onAccept = null;
    }

    run() {
        // exclusive so another local process can't share-bind the RPC port
        this.server.listen({ host: this.host, port: this.port, exclusive: true });
        this.processListeners.forEach(processListener => processListener.start());
    }

    accept(socket) {
        socket.setNoDelay(true);

        if (this.verifyPeer && process.platform === 'win32') {
            this._gatePeer(socket);
            return;
        }

        this._acceptVerified(socket);
    }

    _acceptVerified(socket) {
        if (socket.destroyed)
            return;

        const connection = new ClientInterfaceConnection(socket, this.GPKManager);
        this.connections.add(connection);

        socket.once('error', () => this.onDisconnect(connection));
        socket.once('close', () => this.onDisconnect(connection));

        this.onAccept(connection);

        this.processListeners.forEach(processListener => processListener.setInterval(1000));
    }

    onDisconnect(connection) {
        this.connections.delete(connection);
        this.processListeners.forEach(processListener => processListener.setInterval(this.connections.size > 0 ? 500 : 25));
    }

    // the injected client can connect back before the scanner has recorded its pid, so retry a few times before dropping
    _gatePeer(socket, attempt = 0) {
        if (socket.destroyed)
            return;

        const verdict = this._verifyPeer(socket);
        if (verdict.allow) {
            this._acceptVerified(socket);
            return;
        }

        if (attempt < 4) {
            if (attempt === 0)
                socket.once('error', () => {}); // don't throw if the peer bails while we're deciding
            setTimeout(() => this._gatePeer(socket, attempt + 1), 150);
            return;
        }

        console.warn(
            mui.get('client-interface/index/peer-rejected', { pid: verdict.pid, image: verdict.image || 'unknown' })
        );
        socket.destroy();
    }

    // { allow } if the socket is owned by a process the scanner injected the client interface into
    _verifyPeer(socket) {
        const listeners = [...this.processListeners];
        if (!listeners.length || typeof listeners[0].getInjectedProcesses !== 'function') {
            if (!this._warnedPeerVerifyUnavailable) {
                this._warnedPeerVerifyUnavailable = true;
                console.warn(mui.get('client-interface/index/peer-verify-unavailable'));
            }
            return { allow: true };
        }

        let injected, ownerPid;
        try {
            injected = listeners.flatMap(pl => pl.getInjectedProcesses());
            // the peer's own socket row: its local end is our remote end, not our listener row
            ownerPid = listeners[0].getTcpOwnerPid(socket.remoteAddress, socket.remotePort, socket.localAddress, socket.localPort);
        } catch (e) {
            // don't take the whole proxy down over a lookup failure, just let it through and complain
            console.warn(mui.get('client-interface/index/peer-verify-unavailable'));
            console.warn(e);
            return { allow: true };
        }

        if (injected.some(p => p.pid === ownerPid))
            return { allow: true };

        const image =
            typeof listeners[0].getProcessImagePath === 'function' ? listeners[0].getProcessImagePath(ownerPid) : '';
        return { allow: false, pid: ownerPid, image };
    }
}

module.exports = ClientInterfaceServer;
