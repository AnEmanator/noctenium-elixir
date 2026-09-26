const path = require('path');
const { app, BrowserWindow, powerMonitor, Tray, Menu, ipcMain, shell } = require('electron');
const DataFolder = path.join(__dirname, '..', 'data');
const ModuleFolder = path.join(__dirname, '..', 'mods');

// MUI
const mui = require('@anemanator/toolbox-mui').DefaultInstance;

function InitializeMUI(language) {
    const { InitializeDefaultInstance } = require('@anemanator/toolbox-mui');
    InitializeDefaultInstance(language);
}

// Configuration
function LoadConfiguration() {
    try {
        return require('./config').loadConfig();
    } catch (_) {
        const { dialog } = require('electron');

        dialog.showMessageBoxSync({
            type: 'error',
            title: mui.get('loader-gui/error-config-file-corrupt/title'),
            message: mui.get('loader-gui/error-config-file-corrupt/message')
        });

        app.exit();
    }
}

function SaveConfiguration(newConfig) {
    global.Toolbox.DevMode = !!newConfig.devmode;
    global.Toolbox.GUITheme = newConfig.gui.theme;

    InitializeMUI(newConfig.uilanguage);

    require('./config').saveConfig(newConfig);
}

// Migration
function Migration() {
    try {
        const { ToolboxMigration } = require('./migration');
        ToolboxMigration();
    } catch (e) {
        const { dialog } = require('electron');

        dialog.showMessageBoxSync({
            type: 'error',
            title: mui.get('loader-gui/error-migration-failed/title'),
            message: mui.get('loader-gui/error-migration-failed/message')
        });

        app.exit();
    }
}

// Installed mod management
const {
    listModuleInfos,
    installModule,
    uninstallModule,
    toggleAutoUpdate,
    toggleLoad
} = require('@anemanator/mod-management');

// small list of github repos, pull their module.json directly at browse time.
const InstallableSources = [
    'https://github.com/AnEmanator/elixir-command',
    'https://github.com/AnEmanator/elixir-game-state',
    'https://github.com/hsdn/tera-guide'
];

// raw.githubusercontent base for a github repo url (default branch via HEAD), trailing slash
function githubRawBase(source) {
    const m = /github\.com\/([^/]+)\/([^/#?]+?)(?:\.git|\/|$)/.exec(source || '');
    return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/HEAD/` : null;
}

function githubRawReadmeUrl(source) {
    const base = githubRawBase(source);
    return base ? base + 'README.md' : null;
}

let CachedInstallableMods = null;
async function getInstallableMods(forceRefresh = false) {
    if (!CachedInstallableMods || forceRefresh) {
        const mods = [];
        for (const source of InstallableSources) {
            const base = githubRawBase(source);
            if (!base) continue;

            try {
                const modInfo = await (await fetch(base + 'module.json')).json();
                modInfo.source = source;
                mods.push(modInfo);
            } catch (_) {
                console.warn(mui.get('loader-gui/installable-fetch-failed', { source: source }));
            }
        }
        CachedInstallableMods = mods;
    }

    const installedModInfos = listModuleInfos(ModuleFolder);
    return CachedInstallableMods.filter(m => !installedModInfos.some(i => i.name === String(m.name).toLowerCase()));
}

// Proxy Main
let proxy = null;
let proxyRunning = false;

// The bridge needs a shared secret with the game-side preload. Generate it once, up
// front, so the Settings buttons and the auto-installer always have something to hand out.
function ensureBridgeToken(cfg) {
    if (!cfg.noctenium) cfg.noctenium = {};
    if (!cfg.noctenium.token) {
        cfg.noctenium.token = require('crypto').randomBytes(32).toString('hex');
        require('./config').saveConfig(cfg);
        return true;
    }
    return false;
}

async function _StartProxy(ModuleFolder, ProxyConfig) {
    if (proxy || proxyRunning) return false;

    const NocteniumHost = require('./noctenium-preload/host');
    proxy = new NocteniumHost(ModuleFolder, DataFolder, ProxyConfig);
    proxy.on('status', s => {
        if (gui && gui.window) gui.window.webContents.send('bridge status', s);
    });
    try {
        // Switch to highest process priority so we don't starve because of game client using all CPU
        const { setHighestProcessPriority } = require('./utils');
        setHighestProcessPriority();

        // Start proxy
        await proxy.run();
        proxyRunning = true;
        return true;
    } catch (e) {
        console.error(mui.get('loader-gui/error-cannot-start-proxy'));
        console.error(e);
        if (gui && e && (e.code === 'EADDRINUSE' || e.code === 'EADDRNOTAVAIL'))
            gui.showError(
                mui.get(
                    e.code === 'EADDRNOTAVAIL'
                        ? 'proxy/client-interface-error-EADDRNOTAVAIL'
                        : 'proxy/client-interface-error-EADDRINUSE'
                )
            );
        try {
            if (proxy) proxy.destructor();
        } catch (_) {
            // ignore
        }
        proxy = null;
        proxyRunning = false;
        return false;
    }
}

async function StartProxy(ModuleFolder, ProxyConfig) {
    if (proxy || proxyRunning) return false;

    // Keep the game-side bridge in step with this build. Idempotent, quiet unless it fails.
    if (ProxyConfig.noctenium && ProxyConfig.noctenium.gameBinaries) runBridge('install', { silent: true });

    if (ProxyConfig.noupdate) {
        console.warn(mui.get('loader-gui/warning-noupdate-1'));
        console.warn(mui.get('loader-gui/warning-noupdate-2'));
        console.warn(mui.get('loader-gui/warning-noupdate-3'));
        console.warn(mui.get('loader-gui/warning-noupdate-4'));
        console.warn(mui.get('loader-gui/warning-noupdate-5'));
    } else {
        const autoUpdate = require('./update');

        try {
            const updateResult = await autoUpdate(ModuleFolder, ProxyConfig.updatelog, true);
            updateResult.legacy.forEach(mod =>
                console.warn(mui.get('loader-gui/warning-update-mod-not-supported', { name: mod.name }))
            );
            updateResult.failed.forEach(mod =>
                console.error(mui.get('loader-gui/error-update-mod-failed', { name: mod.name }))
            );
        } catch (e) {
            console.error(mui.get('loader-gui/error-update-failed'));
            console.error(e);
        }
    }

    return _StartProxy(ModuleFolder, ProxyConfig);
}

async function StopProxy() {
    if (!proxy || !proxyRunning) return false;

    // Stop proxy
    proxy.destructor();
    proxy = null;
    proxyRunning = false;

    // Switch back to normal process priority
    const { setNormalProcessPriority } = require('./utils');
    setNormalProcessPriority();

    return true;
}

// Clean exit
const isWindows = process.platform === 'win32';

function cleanExit() {
    console.log(mui.get('loader-gui/terminating'));

    StopProxy().then(() => {
        if (isWindows) process.stdin.pause();
    });
}

if (isWindows) {
    require('readline')
        .createInterface({
            input: process.stdin,
            output: process.stdout
        })
        .on('SIGINT', () => process.emit('SIGINT'));
}

process.on('SIGHUP', cleanExit);
process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);

// IPC
ipcMain.on('init', (event, _) => {
    event.sender.send('set config', config);
    event.sender.send('proxy running', false);
    event.sender.send('is admin', global.Toolbox.IsAdmin);
    event.sender.send('bridge version', require('./noctenium-preload/host').BRIDGE_VERSION);
    event.sender.send('bridge state', bridgeState());

    // what the self-updater had to say before the log tab existed. this has to come after 'set config',
    // the log tab reads its settings from that and throws on any line that arrives before it
    try {
        for (const line of require('./self-update').takeLog()) console[line.type](line.msg);
    } catch (_) {
        // ignore
    }

    if (config.gui.autostart) {
        event.sender.send('proxy starting');
        console.log(mui.get('loader-gui/proxy-starting'));
        StartProxy(ModuleFolder, config).then(result => {
            event.sender.send('proxy running', result);
        });
    }
});

ipcMain.on('start proxy', (event, _) => {
    if (proxy || proxyRunning) return;

    event.sender.send('proxy starting');
    console.log(mui.get('loader-gui/proxy-starting'));
    StartProxy(ModuleFolder, config).then(result => {
        event.sender.send('proxy running', result);
    });
});

ipcMain.on('stop proxy', (event, _) => {
    if (!proxy || !proxyRunning) return;

    console.log(mui.get('loader-gui/proxy-stopping'));
    StopProxy().then(() => {
        event.sender.send('proxy running', false);
        console.log(mui.get('loader-gui/proxy-stopped'));
    });
});

ipcMain.on('get config', (event, _) => {
    event.sender.send('set config', config);
});

ipcMain.on('set config', (event, newConfig) => {
    config = newConfig;
    SaveConfiguration(config);
    event.sender.send('bridge state', bridgeState());
});

ipcMain.on('get mods', (event, _) => {
    event.sender.send('set mods', listModuleInfos(ModuleFolder));
});

ipcMain.on('get installable mods', (event, _) => {
    getInstallableMods(true).then(mods => event.sender.send('set installable mods', mods));
});

ipcMain.on('fetch mod readme', (event, source) => {
    const url = githubRawReadmeUrl(source);
    if (!url) {
        event.sender.send('mod readme', { source: source, ok: false });
        return;
    }

    fetch(url)
        .then(res => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
        .then(markdown => event.sender.send('mod readme', { source: source, ok: true, markdown: markdown }))
        .catch(() => event.sender.send('mod readme', { source: source, ok: false }));
});

ipcMain.on('install mod', (event, modInfo) => {
    installModule(ModuleFolder, modInfo);

    // grab the manifest too so the mod is complete right away (the rest of its files
    // still get pulled by the auto-updater on the next start)
    const base = githubRawBase(modInfo.source);
    if (base) {
        const fs = require('fs');
        const manifestPath = path.join(ModuleFolder, String(modInfo.name).toLowerCase(), 'manifest.json');
        fetch(base + 'manifest.json')
            .then(res => (res.ok ? res.text() : Promise.reject()))
            .then(txt => fs.writeFileSync(manifestPath, txt))
            .catch(() => {});
    }

    console.log(mui.get('loader-gui/mod-installed', { name: modInfo.name }));
    getInstallableMods().then(mods => event.sender.send('set installable mods', mods));
});

ipcMain.on('toggle mod load', (event, modInfo) => {
    toggleLoad(modInfo);
    console.log(mui.get('loader-gui/mod-load-toggled', { enabled: modInfo.disabled, name: modInfo.rawName }));
    event.sender.send('set mods', listModuleInfos(ModuleFolder));
});

ipcMain.on('toggle mod autoupdate', (event, modInfo) => {
    toggleAutoUpdate(modInfo);
    console.log(
        mui.get('loader-gui/mod-updates-toggled', { updatesEnabled: modInfo.disableAutoUpdate, name: modInfo.rawName })
    );
    event.sender.send('set mods', listModuleInfos(ModuleFolder));
});

ipcMain.on('uninstall mod', (event, modInfo) => {
    uninstallModule(modInfo);
    console.log(mui.get('loader-gui/mod-uninstalled', { name: modInfo.rawName }));
    event.sender.send('set mods', listModuleInfos(ModuleFolder));
});

ipcMain.on('show mods folder', () => {
    shell.openPath(ModuleFolder);
});

// window controls, moved off the removed `remote` module (renderer -> here)
ipcMain.on('window-control', (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    switch (action) {
        case 'hide':
            win.hide();
            break;
        case 'minimize':
            win.minimize();
            break;
        case 'close':
            win.close();
            break;
    }
});

ipcMain.handle('save-dialog', (event, options) => {
    const { dialog } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options);
});

ipcMain.handle('open-dialog', (event, options) => {
    const { dialog } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options);
});

// Snapshot of what the renderer needs to enable/disable the bridge buttons.
function bridgeState() {
    const nox = config.noctenium || {};
    return { gameBinaries: nox.gameBinaries || null };
}

// Noctenium Elixir game-side bridge install / uninstall with the configured Game Binaries path.
// Resolves { ok, reason, output }. `silent` keeps the happy path out of the log (used by the
// auto-installer on Start); failures always log.
function runBridge(action, { silent = false } = {}) {
    const gameBinaries = config.noctenium && config.noctenium.gameBinaries;
    if (!gameBinaries) {
        if (!silent) console.error(mui.get('loader-gui/bridge-no-gamebinaries'));
        return { ok: false, reason: 'no-gamebinaries' };
    }
    if (proxy || proxyRunning) {
        if (!silent) console.error(mui.get('loader-gui/bridge-not-while-running'));
        return { ok: false, reason: 'running' };
    }
    const bridge = require('./bridge-installer');
    const r = bridge[action]({ toolboxRoot: path.join(__dirname, '..'), gameBinaries });
    const { key, tokens } = bridge.explain(action, r);
    const message = mui.get(key, tokens);
    if (!r.ok) console.error(message);
    else if (!silent) console.log(message);
    // the modal has no use for the log prefix
    return { ok: r.ok, reason: r.reason, output: r.ok ? '' : message.replace(/^\[elixir\] /, '') };
}

ipcMain.on('bridge install', event => {
    event.sender.send('bridge result', { action: 'install', ...runBridge('install') });
});
ipcMain.on('bridge uninstall', event => {
    event.sender.send('bridge result', { action: 'uninstall', ...runBridge('uninstall') });
});

// GUI
class ToolboxProxyGUI {
    constructor() {
        this.window = null;
        this.tray = null;
    }

    show() {
        if (this.window !== null) {
            this.window.show();
            if (this.window.isMinimized()) this.window.restore();
            this.window.focus();
            return;
        }

        // Migration
        Migration();

        // Load configuration
        config = LoadConfiguration();
        ensureBridgeToken(config);
        InitializeMUI(config.uilanguage);

        global.Toolbox.GUIMode = true;
        global.Toolbox.DevMode = !!config.devmode;

        global.Toolbox.GUITheme = config.gui.theme || 'elixir-dark';

        // Initialise main window
        const guiRoot = path.join(__dirname, 'gui');
        const guiIcon = path.join(guiRoot, '/assets/icon.ico');
        this.window = new BrowserWindow({
            title: 'Noctenium Elixir',
            width: config?.gui?.width || 743,
            height: config?.gui?.height || 514,
            minWidth: 743,
            minHeight: 514,
            icon: guiIcon,
            frame: false,
            resizable: true,
            centered: true,
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                devTools: false,
                spellcheck: false
            }
        });
        this.window.loadFile(path.join(guiRoot, 'main.html'));
        //this.window.webContents.openDevTools();

        this.window.once('ready-to-show', () => {
            this.window.show();
            if (config?.gui?.maximized) this.window.maximize();

            // we got this far, so an update we just applied is good to keep
            try {
                require('./self-update').markHealthy();
            } catch (_) {
                // ignore
            }
        });

        this.window.on('close', () => {
            config.gui.maximized = this.window.isMaximized();
            if (!config.gui.maximized) {
                const size = this.window.getSize();
                config.gui.width = size[0];
                config.gui.height = size[1];
            }

            SaveConfiguration(config);
        });

        //this.window.on('minimize', () => { this.window.hide(); });
        this.window.on('closed', () => {
            StopProxy();
            this.window = null;
        });

        // Initialise tray icon
        this.tray = new Tray(guiIcon);
        this.tray.setToolTip('Noctenium Elixir');
        this.tray.setContextMenu(
            Menu.buildFromTemplate([
                {
                    label: mui.get('loader-gui/tray/quit'),
                    click: () => {
                        app.exit();
                    }
                }
            ])
        );

        this.tray.on('click', () => {
            if (this.window) this.window.isVisible() ? this.window.hide() : this.window.show();
        });

        // Redirect console to built-in one
        const nodeConsole = require('console');
        console = new nodeConsole.Console(process.stdout, process.stderr);

        // keep the original `this` - a bare old_stdout(...) call silently no-ops on Node 24
        const old_stdout = process.stdout.write;
        process.stdout.write = function (msg, ...args) {
            old_stdout.call(process.stdout, msg, ...args);
            log(msg, 'log');
        };
        const old_stderr = process.stderr.write;
        process.stderr.write = function (msg, ...args) {
            old_stderr.call(process.stderr, msg, ...args);
            if (msg.startsWith('warn:')) log(msg.replace('warn:', ''), 'warn');
            else log(msg, 'error');
        };

        powerMonitor.on('suspend', () => {
            if (this.window) {
                if (!proxy || !proxyRunning) return;

                console.log(mui.get('loader-gui/proxy-stopping'));

                StopProxy().then(() => {
                    this.window.webContents.send('proxy running', false);
                    console.log(mui.get('loader-gui/proxy-stopped'));
                });
            }
        });
    }

    hide() {
        if (this.window !== null) this.window.hide();
    }

    close() {
        if (this.window !== null) {
            StopProxy();

            this.window.close();
            this.window = null;
        }
    }

    showError(error) {
        if (this.window) this.window.webContents.send('error', error);
    }

    log(msg, type = 'log') {
        if (this.window) this.window.webContents.send('log', msg, type);
    }
}

// Main
let gui;
let config;

function log(msg, type = 'log') {
    if (msg.length === 0) return;

    if (gui) gui.log(msg, type);
}

process.on('warning', warning => {
    console.warn(warning.name);
    console.warn(warning.message);
    console.warn(warning.stack);
});

// update the toolbox itself. this runs before any native addon is loaded, so the files are free to
// replace. true means an update was applied and we are exiting so the launcher can start us again
async function SelfUpdate() {
    try {
        const selfUpdate = require('./self-update');
        const cfg = require('./config').loadConfig();
        InitializeMUI(cfg.uilanguage);

        if ((await selfUpdate(cfg)) !== 'restart') return false;

        app.exit(selfUpdate.RESTART_EXIT_CODE);
        return true;
    } catch (e) {
        // a broken updater must never stop the app from starting
        console.error(e);
        return false;
    }
}

module.exports = function StartGUI() {
    return new Promise((resolve, reject) => {
        const { initGlobalSettings } = require('./utils');
        initGlobalSettings(false).then(async () => {
            if (await SelfUpdate()) return;

            // Boot GUI
            gui = new ToolboxProxyGUI();

            if (app.isReady()) {
                gui.show();
                resolve();
            } else {
                app.on('ready', () => {
                    gui.show();
                    resolve();
                });
            }

            app.on('second-instance', () => {
                if (gui) gui.show();
            });

            app.on('window-all-closed', () => {
                if (process.platform !== 'darwin') app.quit();
            });

            app.on('activate', () => {
                gui.show();
            });
        });
    });
};
