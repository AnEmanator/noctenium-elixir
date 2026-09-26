// config.json schema migrations. migrations[i] upgrades a config from version i to
// version i+1 by mutating it in place. append an entry (which bumps CURRENT_VERSION)
// whenever a settings key is added, renamed, moved, or changes meaning - don't
// hand-patch that into config.js or the loaders.

const migrations = [
    // 0 -> 1: baseline. bring pre-versioning configs up to every key this build reads.
    config => {
        const top = {
            uilanguage: 'en',
            updatelog: false,
            devmode: false,
            noupdate: false
        };
        for (const key in top) if (config[key] === undefined) config[key] = top[key];

        if (typeof config.noctenium !== 'object' || config.noctenium === null) config.noctenium = {};
        const noctenium = {
            ipcPort: 9260,
            packetTimeoutMs: 100,
            activationTimeoutMs: 1000,
            clientInterface: true,
            gameBinaries: null,
            token: null
        };
        for (const key in noctenium) if (config.noctenium[key] === undefined) config.noctenium[key] = noctenium[key];

        if (typeof config.gui !== 'object' || config.gui === null) config.gui = {};
        const gui = {
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
        };
        for (const key in gui) if (config.gui[key] === undefined) config.gui[key] = gui[key];
    },

    // 1 -> 2: toolbox self-update switch
    config => {
        if (config.noselfupdate === undefined) config.noselfupdate = false;
    }
];

const CURRENT_VERSION = migrations.length;

// returns { config, changed }; `changed` accounts for the version stamp too
function migrate(config) {
    const from = Number.isInteger(config.configVersion) ? config.configVersion : 0;
    let changed = false;

    for (let v = from; v < CURRENT_VERSION; v++) {
        migrations[v](config);
        changed = true;
    }

    if (config.configVersion !== CURRENT_VERSION) {
        config.configVersion = CURRENT_VERSION;
        changed = true;
    }

    return { config, changed };
}

module.exports = { migrate, CURRENT_VERSION };
