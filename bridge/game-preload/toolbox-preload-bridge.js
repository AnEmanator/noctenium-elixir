/* Copyright (C) 2026 AnEmanator. All Rights Reserved. */

// Loads the native bridge. Loaded by Bun via Binaries\bunfig.toml.
try {
    require('./toolbox-preload-bridge.node');
} catch (e) {
    try {
        const fs = require('fs');
        const path = require('path');
        const exe = String(process.execPath || '');
        if (/noctenium\.exe$/i.test(exe) && fs.existsSync(path.join(__dirname, 'toolbox-preload-bridge.enabled'))) {
            const logDir = path.join(__dirname, 'logs');
            fs.mkdirSync(logDir, { recursive: true });
            // numeric ids to match the addon's log format (events.def: ev 1 = addon-load-error, f1 = error)
            const line = {
                ts: new Date().toISOString(),
                ev: 1,
                pid: process.pid,
                f1: String(e && e.message ? e.message : e)
            };
            fs.appendFileSync(path.join(logDir, 'toolbox-preload-bridge.log'), JSON.stringify(line) + '\n');
        }
    } catch {}
}
