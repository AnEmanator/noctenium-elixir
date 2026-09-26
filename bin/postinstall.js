// electron 44 dropped the postinstall that older electron (11.x) used to fetch its
// binary, so a plain `npm ci` now leaves node_modules/electron with only the JS
// shims and no runnable build. run electron's own installer here to put it back,
// matching the pre-#10 behaviour so people don't get a surprise ~150 MB download
// on first launch. ELECTRON_SKIP_BINARY_DOWNLOAD keeps CI (lint only) fast.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
    process.exit(0);
}

// electron is a devDependency, so a production install legitimately won't have it
const installer = path.join(__dirname, '..', 'node_modules', 'electron', 'install.js');
if (!fs.existsSync(installer)) {
    process.exit(0);
}

const res = spawnSync(process.execPath, [installer], { stdio: 'inherit' });
if (res.status !== 0) {
    // not fatal - the toolbox launcher downloads electron on first run anyway
    console.warn('[postinstall] electron binary not installed, it will be fetched on first launch');
}
