const path = require('path');
const fs = require('fs');
const { migrate, CURRENT_VERSION } = require('./config-migration');

const ConfigFilePath = path.join(__dirname, '..', 'config.json');

// shape of a brand-new config. existing files are brought up to date by config-migration.
function defaultConfig() {
    return {
        configVersion: CURRENT_VERSION,
        uilanguage: 'en',
        updatelog: false,
        devmode: false,
        noupdate: false,
        noselfupdate: false,
        noctenium: {
            ipcPort: 9260,
            packetTimeoutMs: 100,
            activationTimeoutMs: 1000,
            clientInterface: true,
            gameBinaries: null,
            token: null
        },
        gui: {
            enabled: true,
            theme: 'elixir-dark',
            autostart: false,
            logtimes: true,
            cleanstart: false,
            minimizetotray: false,
            width: 743,
            height: 514,
            maximized: false,
            modsDisplayMode: 'card',
            getMoreModsDisplayMode: 'card'
        }
    };
}

function loadConfig() {
    let raw;
    try {
        raw = fs.readFileSync(ConfigFilePath, 'utf8');
    } catch (_) {
        // no file yet - hand back the default without writing it (first run persists on first change)
        return defaultConfig();
    }

    const { config, changed } = migrate(JSON.parse(raw));
    if (changed) saveConfig(config);
    return config;
}

function saveConfig(newConfig) {
    fs.writeFileSync(ConfigFilePath, JSON.stringify(newConfig, null, 4));
}

module.exports = { loadConfig, saveConfig, defaultConfig };
