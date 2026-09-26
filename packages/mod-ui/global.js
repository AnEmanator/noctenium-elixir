const IPCChannel = 'mod-ui-ipc';
// separate channel for window controls so they don't collide with mod event names,
// and so isMaximized() can use a sync round trip (replaces the removed remote module)
const WindowControlChannel = 'mod-ui-window-control';

module.exports = { IPCChannel, WindowControlChannel };
