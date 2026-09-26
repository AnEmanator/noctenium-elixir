function checkRuntimeCompatibility() {
    if (process.versions.electron === undefined) {
        // We're on Node.JS
        if (process.versions.modules < 137) throw new Error('NodeTooOld');
    } else {
        // We're on Electron
        if (process.versions.modules < 149) throw new Error('NodeTooOld');
    }

    return true;
}

async function initGlobalSettings(DevMode = false) {
    const { warnDeprecated } = require('@anemanator/toolbox-mui');

    global.Toolbox = {
        DevMode: !!DevMode,
        GUIMode: !!process.versions.electron,
        IsAdmin: await isAdmin(),
        get UILanguage() {
            warnDeprecated('deprecated/global-uilanguage');
            return require('@anemanator/toolbox-mui').language;
        }
    };

    // back-compat: old mods still read global.TeraProxy. warn (naming the mod), then forward.
    global.TeraProxy = new Proxy(global.Toolbox, {
        get(target, prop) {
            warnDeprecated('deprecated/global-teraproxy');
            return Reflect.get(target, prop);
        }
    });
}

function setHighestProcessPriority() {
    const os = require('os');
    os.setPriority(os.constants.priority.PRIORITY_ABOVE_NORMAL);
}

function setNormalProcessPriority() {
    const os = require('os');
    os.setPriority(os.constants.priority.PRIORITY_NORMAL);
}

// See https://github.com/sindresorhus/is-admin
function isAdmin() {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        exec('fsutil dirty query %systemdrive%', (err, so, se) => {
            if (!err) {
                resolve(true);
            } else {
                if (err.code === 1) resolve(false);
                else reject(err);
            }
        });
    });
}

/**
 * Remove directory recursively
 * @param {string} dir_path
 * @see https://stackoverflow.com/a/42505874/3027390
 */
function rimraf(dir_path) {
    const fs = require('fs');
    const path = require('path');
    try {
        fs.readdirSync(dir_path).forEach(entry => {
            const entry_path = path.join(dir_path, entry);
            if (fs.lstatSync(entry_path).isDirectory()) rimraf(entry_path);
            else fs.unlinkSync(entry_path);
        });

        fs.rmdirSync(dir_path);
    } catch (e) {
        // Ignore
    }
}

module.exports = {
    checkRuntimeCompatibility,
    initGlobalSettings,
    setNormalProcessPriority,
    setHighestProcessPriority,
    isAdmin,
    rimraf
};
