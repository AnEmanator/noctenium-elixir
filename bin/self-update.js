const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mui = require('@anemanator/toolbox-mui').DefaultInstance;

// where releases are published (the contents of _out/). TOOLBOX_UPDATE_URL overrides it for testing
const UpdateServer = 'https://raw.githubusercontent.com/AnEmanator/noctenium-elixir/main/';

// exit code that asks the launcher to start us again once an update was applied
const RESTART_EXIT_CODE = 75;

const ManifestTimeoutMs = 6000;
const FileTimeoutMs = 30000;
const StaleLockMs = 10 * 60 * 1000;

const root = path.join(__dirname, '..');
const manifestFile = path.join(root, 'manifest.json');
const stateDir = path.join(root, '_update');
const stagedDir = path.join(stateDir, 'staged');
const backupDir = path.join(stateDir, 'backup');
const lockDir = path.join(stateDir, 'lock');
const appliedFile = path.join(stateDir, 'applied.json'); // present until the new version boots fine
const restartedFile = path.join(stateDir, 'restarted'); // loop guard + what to tell the user on the next boot
const badFile = path.join(stateDir, 'bad.json'); // version that failed to boot, never fetched again

// the manifest is remote input, so it can only ever touch files the updater owns
const Denied = [/^(mods|node_modules|_update|\.git)(\/|$)/i, /^config\.json$/i, /^manifest\.json$/i, /\.exe$/i];

function safeRel(rel) {
    if (typeof rel !== 'string' || !rel || /[\\:\0]/.test(rel) || rel.startsWith('/')) return false;

    // trailing dots/spaces and 8.3 names are quietly folded into other paths by windows
    const parts = rel.split('/');
    if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /~\d/.test(p))) return false;
    if (Denied.some(re => re.test(rel))) return false;

    return path.resolve(root, rel).startsWith(root + path.sep);
}

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const rm = target => fs.rmSync(target, { recursive: true, force: true });
const inRoot = rel => path.join(root, ...rel.split('/'));

function walk(dir, base = '') {
    let out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = base ? `${base}/${entry.name}` : entry.name;
        out = entry.isDirectory() ? out.concat(walk(path.join(dir, entry.name), rel)) : out.concat(rel);
    }
    return out;
}

// lines are kept so the GUI can show them in its log tab once that exists
let logLines = [];
let echo = false;

function log(type, key, tokens) {
    const msg = mui.get(key, tokens);
    logLines.push({ type, msg });
    if (echo) console[type](msg);
}

function takeLog() {
    const lines = logLines;
    logLines = [];
    return lines;
}

async function download(url, timeoutMs) {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`);
    return Buffer.from(await res.arrayBuffer());
}

function serverUrl() {
    const url = process.env.TOOLBOX_UPDATE_URL || UpdateServer;
    if (!process.env.TOOLBOX_UPDATE_URL && !url.startsWith('https://')) throw new Error('Update server is not https');
    return url.endsWith('/') ? url : `${url}/`;
}

function parseManifest(buf) {
    const manifest = JSON.parse(buf.toString('utf8'));
    if (!manifest || typeof manifest.files !== 'object' || Array.isArray(manifest.files))
        throw new Error('Invalid update manifest');

    for (const [rel, hash] of Object.entries(manifest.files)) {
        if (!safeRel(rel) || !/^[0-9a-f]{64}$/i.test(hash)) throw new Error(`Invalid update manifest entry: ${rel}`);
    }

    return manifest;
}

function takeLock() {
    fs.mkdirSync(stateDir, { recursive: true });
    try {
        fs.mkdirSync(lockDir);
        return true;
    } catch (e) {
        if (e.code !== 'EEXIST') throw e;
    }

    // another instance is updating, unless it died a while ago
    if (Date.now() - fs.statSync(lockDir).mtimeMs < StaleLockMs) return false;
    rm(lockDir);
    fs.mkdirSync(lockDir);
    return true;
}

// puts every touched file back. true only if all of it worked
function undo(ops) {
    let ok = true;
    for (const op of [...ops].reverse()) {
        try {
            const target = inRoot(op.rel);
            if (op.placed) fs.rmSync(target, { force: true });
            if (op.backup) {
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.renameSync(path.join(backupDir, ...op.rel.split('/')), target);
            }
        } catch (_) {
            ok = false;
        }
    }
    return ok;
}

// move everything staged into place, keeping the originals in backup/. all or nothing
function apply(changed, removed, remote, manifestBuf) {
    fs.writeFileSync(path.join(stagedDir, 'manifest.json'), manifestBuf);

    const ops = [];
    try {
        for (const rel of [...changed, 'manifest.json']) {
            const target = inRoot(rel);
            const op = { rel, backup: false, placed: false };
            ops.push(op);

            fs.mkdirSync(path.dirname(target), { recursive: true });
            if (fs.existsSync(target)) {
                const saved = path.join(backupDir, ...rel.split('/'));
                fs.mkdirSync(path.dirname(saved), { recursive: true });
                fs.renameSync(target, saved);
                op.backup = true;
            }

            fs.renameSync(path.join(stagedDir, ...rel.split('/')), target);
            op.placed = true;
        }

        for (const rel of removed) {
            const saved = path.join(backupDir, ...rel.split('/'));
            fs.mkdirSync(path.dirname(saved), { recursive: true });
            fs.renameSync(inRoot(rel), saved);
            ops.push({ rel, backup: true, placed: false });
        }

        for (const rel of changed) {
            if (sha256(fs.readFileSync(inRoot(rel))) !== remote.files[rel].toLowerCase())
                throw new Error(`Verification failed for ${rel}`);
        }
    } catch (e) {
        // only clear the backups once everything is safely back, they may be the only copy
        if (undo(ops)) rm(backupDir);
        throw e;
    }

    return ops.filter(op => op.placed && !op.backup).map(op => op.rel);
}

// the update we applied never got as far as a healthy boot: put the old version back
function recover() {
    const applied = readJson(appliedFile);

    for (const rel of fs.existsSync(backupDir) ? walk(backupDir) : []) {
        const target = inRoot(rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.renameSync(path.join(backupDir, ...rel.split('/')), target);
    }
    for (const rel of applied.added || []) {
        if (safeRel(rel)) fs.rmSync(inRoot(rel), { force: true });
    }

    fs.writeFileSync(badFile, JSON.stringify({ version: applied.to }));
    fs.writeFileSync(restartedFile, JSON.stringify({ type: 'rolledback', version: applied.to }));
    rm(backupDir);
    rm(appliedFile);
}

async function check(config) {
    const local = readJson(manifestFile);
    const from = readJson(path.join(root, 'package.json')).version;
    const server = serverUrl();

    const manifestBuf = await download(`${server}manifest.json`, ManifestTimeoutMs);
    const remote = parseManifest(manifestBuf);
    const to = typeof remote.version === 'string' ? remote.version : '?';

    try {
        if (readJson(badFile).version === to) {
            if (config.updatelog) log('log', 'self-update/skipping-bad-version', { version: to });
            return 'none';
        }
    } catch (_) {
        // no bad.json
    }

    const changed = Object.keys(remote.files).filter(rel => {
        const target = inRoot(rel);
        return !fs.existsSync(target) || sha256(fs.readFileSync(target)) !== remote.files[rel].toLowerCase();
    });

    // shipped last time, not this time. only ever paths our own manifest listed
    const removed = Object.keys(local.files || {}).filter(
        rel => !(rel in remote.files) && safeRel(rel) && fs.existsSync(inRoot(rel))
    );

    if (!changed.length && !removed.length) {
        if (config.updatelog) log('log', 'self-update/up-to-date');
        return 'none';
    }

    log('log', 'self-update/downloading', { from, to, count: changed.length });
    for (const rel of changed) {
        if (config.updatelog) log('log', 'self-update/download-file', { file: rel });

        const buf = await download(server + rel.split('/').map(encodeURIComponent).join('/'), FileTimeoutMs);
        if (sha256(buf) !== remote.files[rel].toLowerCase())
            throw new Error(`Downloaded ${rel} does not match the manifest`);

        const staged = path.join(stagedDir, ...rel.split('/'));
        fs.mkdirSync(path.dirname(staged), { recursive: true });
        fs.writeFileSync(staged, buf);
    }

    const added = apply(changed, removed, remote, manifestBuf);

    fs.writeFileSync(appliedFile, JSON.stringify({ from, to, added }));
    fs.writeFileSync(restartedFile, JSON.stringify({ type: 'updated', from, to }));
    return 'restart';
}

async function run(config) {
    // a source checkout has no manifest.json, so it can never overwrite itself
    if (!fs.existsSync(manifestFile)) return 'none';

    if (config.noselfupdate) {
        log('warn', 'self-update/warning-disabled');
        return 'none';
    }

    // right after a restart: skip the check (loop guard) and say what happened
    if (fs.existsSync(restartedFile)) {
        try {
            const info = readJson(restartedFile);
            if (info.type === 'rolledback') log('warn', 'self-update/rolled-back', { version: info.version });
            else if (info.type === 'updated') log('log', 'self-update/applied', { from: info.from, to: info.to });
        } catch (_) {
            // unreadable marker, nothing to report
        }
        rm(restartedFile);
        return 'none';
    }

    // an update was applied but the boot after it never got healthy
    if (fs.existsSync(appliedFile)) {
        recover();
        return 'restart';
    }

    if (!takeLock()) {
        if (config.updatelog) log('log', 'self-update/other-instance');
        return 'none';
    }

    try {
        return await check(config);
    } finally {
        rm(lockDir);
        rm(stagedDir);
    }
}

// never throws: worst case we say why and carry on with what is installed
async function selfUpdate(config, echoToConsole = false) {
    echo = echoToConsole;
    try {
        return await run(config);
    } catch (e) {
        try {
            rm(stagedDir);
            rm(lockDir);
        } catch (_) {
            // ignore
        }
        // fetch only says "fetch failed", the reason (ECONNREFUSED, ENOTFOUND...) is on the cause
        const cause = e && e.cause && (e.cause.code || e.cause.message);
        const message = e && e.message ? e.message : String(e);
        log('error', 'self-update/failed', { message: cause ? `${message} (${cause})` : message });
        return 'none';
    }
}

// called once the new version got as far as a working window / proxy. the undo trail can go
function markHealthy() {
    try {
        for (const target of [appliedFile, restartedFile, backupDir, stagedDir, lockDir]) rm(target);
        if (fs.existsSync(stateDir) && !fs.readdirSync(stateDir).length) fs.rmdirSync(stateDir);
    } catch (_) {
        // ignore
    }
}

module.exports = selfUpdate;
module.exports.RESTART_EXIT_CODE = RESTART_EXIT_CODE;
module.exports.takeLog = takeLog;
module.exports.markHealthy = markHealthy;
