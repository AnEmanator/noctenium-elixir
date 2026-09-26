'use strict';

const { app } = require('electron');
const path = require('path');

// Utility
function dialogAndQuit(data) {
    const { dialog } = require('electron');
    dialog.showMessageBoxSync(data);
    app.exit();
}

// Splash Screen
let SplashScreen = null;
let SplashScreenShowTime = 0;

function showSplashScreen() {
    try {
        const guiRoot = path.join(__dirname, 'gui');
        const guiIcon = path.join(guiRoot, '/assets/icon.ico');

        const { BrowserWindow } = require('electron');
        SplashScreen = new BrowserWindow({
            title: 'Noctenium Elixir',
            width: 743,
            height: 514,
            minWidth: 743,
            minHeight: 514,
            icon: guiIcon,
            frame: false,
            resizable: false,
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                devTools: false
            }
        });

        SplashScreen.loadFile(path.join(guiRoot, 'splash.html'));
        SplashScreen.once('ready-to-show', () => SplashScreen.show());
        SplashScreenShowTime = Date.now();
    } catch (e) {
        // Ignore any error resulting from splash screen
        SplashScreen = null;
    }
}

function hideSplashScreen(onDone) {
    setTimeout(
        () => {
            onDone().then(() => {
                if (SplashScreen) {
                    SplashScreen.close();
                    SplashScreen = null;
                }
            });
        },
        SplashScreen ? Math.max(0, 1500 - (Date.now() - SplashScreenShowTime)) : 0
    );
}

// Main function
async function run() {
    const start = require('./loader-gui');
    await start();
}

function main() {
    showSplashScreen();

    // electron is provisioned by `npm ci`, which the launcher runs whenever the
    // lockfile changed. if it somehow doesn't match, bail with a clear message
    // instead of trying to self-heal here.
    const pinnedElectron = require('electron/package.json').version;
    if (process.versions.electron !== pinnedElectron) {
        dialogAndQuit({
            type: 'error',
            title: 'Electron version mismatch',
            message: `Noctenium Elixir expected Electron ${pinnedElectron} but is running ${process.versions.electron}.\n\nClose this and relaunch NocteniumElixir.exe, which will reinstall what's needed.`
        });
        return;
    }

    hideSplashScreen(run);
}

// -------------------------------------------------------------------
// Boot
if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('force_low_power_gpu');

if (app.isReady()) main();
else app.on('ready', main);
