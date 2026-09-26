const path = require('path');
const DataFolder = path.join(__dirname, '..', 'data');
const ModuleFolder = path.join(__dirname, '..', 'mods');

// MUI
const mui = require('@anemanator/toolbox-mui').DefaultInstance;

function InitializeMUI(language) {
    const { InitializeDefaultInstance } = require('@anemanator/toolbox-mui');
    InitializeDefaultInstance(language);
}

// Check node version
function NodeVersionCheck() {
    const { checkRuntimeCompatibility } = require('./utils');

    try {
        checkRuntimeCompatibility();
        return true;
    } catch (e) {
        switch (e.message) {
            case 'NodeTooOld':
                console.error(mui.get('loader-cli/error-node-too-old-1'));
                console.error(mui.get('loader-cli/error-node-too-old-2'));
                break;
            default:
                console.error(mui.get('loader-cli/error-runtime-incompatible-default', { message: e.message }));
        }

        return false;
    }
}

// Load and validate configuration
function LoadConfiguration() {
    try {
        return require('./config').loadConfig();
    } catch (e) {
        console.error(mui.get('loader-cli/error-config-corrupt-1'));
        console.error(mui.get('loader-cli/error-config-corrupt-2'));
        return null;
    }
}

// Migration
function Migration() {
    try {
        const { ToolboxMigration } = require('./migration');
        ToolboxMigration();
        return true;
    } catch (e) {
        console.error(mui.get('loader-cli/error-migration-failed-1'));
        console.error(mui.get('loader-cli/error-migration-failed-2'));
        console.error(mui.get('loader-cli/error-migration-failed-3'));
        return false;
    }
}

// Keep the game-side bridge in step with this build. Idempotent; best-effort on the CLI.
function updateGameBridge(ProxyConfig) {
    const gameBinaries = ProxyConfig.noctenium && ProxyConfig.noctenium.gameBinaries;
    if (!gameBinaries) return;
    const bridge = require('./bridge-installer');
    const r = bridge.install({ toolboxRoot: path.join(__dirname, '..'), gameBinaries });
    if (!r.ok) {
        const { key, tokens } = bridge.explain('install', r);
        console.warn(mui.get(key, tokens));
    }
}

// update the toolbox itself. runs before any native addon is loaded, so the files are free to replace.
// exits with the restart code (the launcher starts us again) when an update was applied
async function SelfUpdate(ProxyConfig) {
    try {
        const selfUpdate = require('./self-update');
        if ((await selfUpdate(ProxyConfig, true)) === 'restart') process.exit(selfUpdate.RESTART_EXIT_CODE);
    } catch (e) {
        // a broken updater must never stop the toolbox from starting
        console.error(e);
    }
}

// we got far enough that an update we just applied is good to keep
function MarkHealthy() {
    try {
        require('./self-update').markHealthy();
    } catch (_) {
        // ignore
    }
}

// Proxy main function
function RunProxy(ModuleFolder, ProxyConfig) {
    if (!ProxyConfig.noctenium) ProxyConfig.noctenium = {};
    if (!ProxyConfig.noctenium.token) {
        ProxyConfig.noctenium.token = require('crypto').randomBytes(32).toString('hex');
        require('./config').saveConfig(ProxyConfig);
    }

    updateGameBridge(ProxyConfig);

    const NocteniumHost = require('./noctenium-preload/host');
    let proxy = new NocteniumHost(ModuleFolder, DataFolder, ProxyConfig);

    // Switch to highest process priority so we don't starve because of game client using all CPU
    const { setHighestProcessPriority } = require('./utils');
    setHighestProcessPriority();

    // Start proxy - a failure to bind the IPC port is fatal for the CLI
    proxy
        .run()
        .then(MarkHealthy)
        .catch(e => {
            console.error(mui.get('loader-cli/error-cannot-start-proxy'));
            console.error(e);
            try {
                proxy.destructor();
            } catch (_) {
                // ignore
            }
            process.exit(1);
        });

    // Set up clean exit
    const isWindows = process.platform === 'win32';

    function cleanExit() {
        console.log(mui.get('loader-cli/terminating'));

        proxy.destructor();
        proxy = null;

        if (isWindows) process.stdin.pause();
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
}

// Main
process.on('warning', warning => {
    console.warn(warning.name);
    console.warn(warning.message);
    console.warn(warning.stack);
});

const { initGlobalSettings } = require('./utils');
initGlobalSettings(false)
    .then(async () => {
        if (NodeVersionCheck()) {
            if (Migration()) {
                const ProxyConfig = LoadConfiguration();
                if (ProxyConfig !== null) {
                    InitializeMUI(ProxyConfig.uilanguage);
                    global.Toolbox.DevMode = !!ProxyConfig.devmode;
                    global.Toolbox.GUIMode = false;

                    await SelfUpdate(ProxyConfig);

                    // Auto-update mods and run
                    if (ProxyConfig.noupdate) {
                        console.warn(mui.get('loader-cli/warning-noupdate-1'));
                        console.warn(mui.get('loader-cli/warning-noupdate-2'));
                        console.warn(mui.get('loader-cli/warning-noupdate-3'));
                        console.warn(mui.get('loader-cli/warning-noupdate-4'));
                        console.warn(mui.get('loader-cli/warning-noupdate-5'));
                        RunProxy(ModuleFolder, ProxyConfig);
                    } else {
                        const autoUpdate = require('./update');
                        autoUpdate(ModuleFolder, ProxyConfig.updatelog, true)
                            .then(updateResult => {
                                updateResult.legacy.forEach(mod =>
                                    console.warn(
                                        mui.get('loader-cli/warning-update-mod-not-supported', { name: mod.name })
                                    )
                                );
                                updateResult.failed.forEach(mod =>
                                    console.error(mui.get('loader-cli/error-update-mod-failed', { name: mod.name }))
                                );
                            })
                            .catch(e => {
                                console.error(mui.get('loader-cli/error-update-failed'));
                                console.error(e);
                            })
                            .finally(() => {
                                RunProxy(ModuleFolder, ProxyConfig);
                            });
                    }
                }
            }
        }
    })
    .catch(e => {
        console.error(e);
    });
