const EventEmitter = require('events');
const { IPCChannel, WindowControlChannel } = require('./global.js');

class Renderer extends EventEmitter {
    constructor() {
        super();

        this.ipc = require('electron').ipcRenderer;

        this._handleEvent = this._handleEvent.bind(this);
        this.ipc.on(IPCChannel, this._handleEvent);
    }

    destructor() {
        this.ipc.removeListener(IPCChannel, this._handleEvent);
        this.ipc = null;
    }

    _handleEvent(event, name, ...args) {
        this.emit(name, ...args);
    }

    send(name, ...args) {
        this.ipc.send(IPCChannel, name, ...args);
    }

    minimize() {
        return this.ipc.send(WindowControlChannel, 'minimize');
    }

    maximize() {
        return this.ipc.send(WindowControlChannel, 'maximize');
    }

    unmaximize() {
        return this.ipc.send(WindowControlChannel, 'unmaximize');
    }

    isMaximized() {
        // sync so toggleMaximized() and mod code that reads the return value keep working
        return this.ipc.sendSync(WindowControlChannel, 'isMaximized');
    }

    toggleMaximized() {
        if (this.isMaximized())
            return this.unmaximize();
        else
            return this.maximize();
    }

    close() {
        return this.ipc.send(WindowControlChannel, 'close');
    }
}

module.exports = Renderer;
