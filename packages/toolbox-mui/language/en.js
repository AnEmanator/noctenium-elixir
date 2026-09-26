const Name = 'English';

function GetString(str, tokens) {
    switch (str) {
        // loader-cli
        case 'loader-cli/error-node-too-old-1': return 'ERROR: Your installed version of Node.JS is too old to run Noctenium Elixir!';
        case 'loader-cli/error-node-too-old-2': return 'ERROR: Please redownload and reinstall Noctenium Elixir, or install the latest version of Node.JS from https://nodejs.org/en/download/current/';
        case 'loader-cli/error-runtime-incompatible-default': return `ERROR: ${tokens.message}`;
        case 'loader-cli/error-config-corrupt-1': return 'ERROR: Whoops, looks like you\'ve fucked up your config.json!';
        case 'loader-cli/error-config-corrupt-2': return 'ERROR: Try to fix it yourself, or delete it to generate a new one.';
        case 'loader-cli/error-migration-failed-1': return 'ERROR: Unable to migrate files from an old version of Noctenium Elixir!';
        case 'loader-cli/error-migration-failed-2': return 'ERROR: Please reinstall a clean copy using the latest release';
        case 'loader-cli/error-migration-failed-3': return 'ERROR: Make sure you are on the latest release.';
        case 'loader-cli/error-cannot-start-proxy': return '[elixir] Unable to start the network proxy, terminating...';
        case 'loader-cli/terminating': return 'terminating...';
        case 'loader-cli/warning-noupdate-1': return '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!';
        case 'loader-cli/warning-noupdate-2': return '!!!!!      YOU HAVE GLOBALLY DISABLED AUTOMATIC UPDATES     !!!!!';
        case 'loader-cli/warning-noupdate-3': return '!!!!! THERE WILL BE NO SUPPORT FOR ANY KIND OF PROBLEM THAT !!!!!';
        case 'loader-cli/warning-noupdate-4': return '!!!!!      YOU MIGHT ENCOUNTER AS A RESULT OF DOING SO      !!!!!';
        case 'loader-cli/warning-noupdate-5': return '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!';
        case 'loader-cli/warning-update-mod-not-supported': return `[update] WARNING: Module ${tokens.name} does not support auto-updating!`;
        case 'loader-cli/error-update-mod-failed': return `[update] ERROR: Module ${tokens.name} could not be updated and might be broken!`;
        case 'loader-cli/error-update-failed': return 'ERROR: Unable to auto-update! The full error message is:';

        // loader-gui
        case 'loader-gui/tray/quit': return 'Quit';
        case 'loader-gui/error-config-file-corrupt/title': return 'Invalid settings file!';
        case 'loader-gui/error-config-file-corrupt/message': return 'The config.json file in your Noctenium Elixir folder is malformed. Try to fix it yourself, or delete it to generate a new one.\n\nThe program will now be terminated.';
        case 'loader-gui/error-migration-failed/title': return 'Migration error!';
        case 'loader-gui/error-migration-failed/message': return 'Unable to migrate files from an old version of Noctenium Elixir.\nPlease reinstall a clean copy using the latest release.\n\nThe program will now be terminated.';
        case 'loader-gui/error-cannot-start-proxy': return '[elixir] Unable to start the network proxy!';
        case 'loader-gui/terminating': return 'terminating...';
        case 'loader-gui/warning-noupdate-1': return '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!';
        case 'loader-gui/warning-noupdate-2': return '!!!!!      YOU HAVE GLOBALLY DISABLED AUTOMATIC UPDATES     !!!!!';
        case 'loader-gui/warning-noupdate-3': return '!!!!! THERE WILL BE NO SUPPORT FOR ANY KIND OF PROBLEM THAT !!!!!';
        case 'loader-gui/warning-noupdate-4': return '!!!!!      YOU MIGHT ENCOUNTER AS A RESULT OF DOING SO      !!!!!';
        case 'loader-gui/warning-noupdate-5': return '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!';
        case 'loader-gui/warning-update-mod-not-supported': return `[update] WARNING: Module ${tokens.name} does not support auto-updating!`;
        case 'loader-gui/error-update-mod-failed': return `[update] ERROR: Module ${tokens.name} could not be updated and might be broken!`;
        case 'loader-gui/error-update-failed': return 'ERROR: Unable to auto-update! The full error message is:';
        case 'loader-gui/proxy-starting': return '[elixir] Starting the network proxy...';
        case 'loader-gui/proxy-stopping': return '[elixir] Stopping the network proxy...';
        case 'loader-gui/proxy-stopped': return '[elixir] Network proxy stopped!';
        case 'loader-gui/installable-fetch-failed': return `[elixir] Could not fetch mod info from ${tokens.source}`;
        case 'loader-gui/mod-installed': return `[elixir] Installed "${tokens.name}"`;
        case 'loader-gui/mod-uninstalled': return `[elixir] Uninstalled "${tokens.name}"`;
        case 'loader-gui/mod-load-toggled': return `[elixir] ${tokens.enabled ? 'Enabled' : 'Disabled'} "${tokens.name}"`;
        case 'loader-gui/mod-updates-toggled': return `[elixir] ${tokens.updatesEnabled ? 'Enabled' : 'Disabled'} automatic updates for "${tokens.name}"`;
        case 'loader-gui/bridge-not-while-running': return '[elixir] Stop Noctenium Elixir before installing or uninstalling the game-side bridge.';
        case 'loader-gui/bridge-no-gamebinaries': return '[elixir] Set your Game Binaries folder in Settings first.';

        // proxy startup
        case 'proxy/client-interface-error-EADDRINUSE': return '[elixir] ERROR: Another instance of Noctenium Elixir is already running, or something else is using the bridge port. Close it or restart your computer and try again!';
        case 'proxy/client-interface-error-EADDRNOTAVAIL': return '[elixir] ERROR: Address not available. Restart your computer and try again!';

        // noctenium bridge host
        case 'noctenium/started': return '[elixir] Started, waiting for the game';
        case 'noctenium/client-interface-connected': return '[elixir] Game started, ClientInterface connected';
        case 'noctenium/bridge-connected': return '[elixir] Game started, bridge connected';
        case 'noctenium/error-ipc': return `[elixir] ERROR: The bridge server hit an error: ${tokens.error}`;
        case 'noctenium/error-client-interface-start': return `[elixir] ERROR: ClientInterface could not start, DataCenter queries are unavailable: ${tokens.error}`;
        case 'noctenium/error-client-interface': return `[elixir] ERROR: ClientInterface error: ${tokens.error}`;
        case 'noctenium/error-bridge-auth': return '[elixir] ERROR: The game-side bridge could not be verified. Reinstall it from Settings and try again.';
        case 'noctenium/error-bridge-library': return '[elixir] ERROR: The bridge library is missing or failed to load. Reinstall Noctenium Elixir.';
        case 'noctenium/error-bridge-map': return `[elixir] ERROR: Could not load the protocol map: ${tokens.error}`;
        case 'noctenium/error-bridge': return `[elixir] ERROR: Bridge error: ${tokens.error}`;

        // noctenium bridge install / uninstall
        case 'noctenium/install-success': return '[elixir] Install success! Start Noctenium Elixir, then launch the game normally.';
        case 'noctenium/install-error-no-config': return '[elixir] Install failed: config.json is missing. Restart Noctenium Elixir and try again.';
        case 'noctenium/install-error-no-token': return '[elixir] Install failed: no bridge token yet. Restart Noctenium Elixir and try again.';
        case 'noctenium/install-error-missing-game-file': return `[elixir] Install failed: ${tokens.file} is missing from your Game Binaries folder.`;
        case 'noctenium/install-error-missing-payload': return '[elixir] Install failed: the bridge files are missing from this install. Reinstall Noctenium Elixir.';
        case 'noctenium/install-error-foreign-preload': return '[elixir] Install failed: bunfig.toml already has another Bun preload. Remove it and try again.';
        case 'noctenium/install-error-locked': return '[elixir] Install failed: the bridge is in use. Close the game and Noctenium, then try again.';
        case 'noctenium/install-error': return `[elixir] Install failed: ${tokens.error}`;
        case 'noctenium/uninstall-success': return '[elixir] Uninstall success! The game-side bridge has been removed.';
        case 'noctenium/uninstall-error-locked': return '[elixir] Uninstall failed: the bridge is in use. Close the game and Noctenium, then try again.';
        case 'noctenium/uninstall-error': return `[elixir] Uninstall failed: ${tokens.error}`;

        // update
        case 'update/started': return '[update] Auto-update started!';
        case 'update/core-module-initialized': return `[update] Initialised core module "${tokens.coreModule}"`;
        case 'update/dependency-module-initialized': return `[update] Initialised dependency "${tokens.dependency}" for module "${tokens.name}"`;
        case 'update/warning-module-update-disabled': return `[update] WARNING: Auto-update disabled for module ${tokens.name}!`;
        case 'update/start-module-install': return `[update] Installing module ${tokens.name}`;
        case 'update/start-module-update': return `[update] Updating module ${tokens.name}`;
        case 'update/warning-module-no-update-servers': return `[update] WARNING: Module ${tokens.name} does not have any update servers specified!`;
        case 'update/module-download-manifest': return `[update] - Retrieving update manifest (Server ${tokens.serverIndex})`;
        case 'update/module-download-file': return `[update] - Download ${tokens.file}`;
        case 'update/module-config-changed': return '[update] - Module configuration changed, restarting update!';
        case 'update/module-update-failed-1': return `[update] ERROR: Unable to auto-update module ${tokens.name}:`;
        case 'update/module-update-failed-2-1': return `[update] Please go to ${tokens.supportUrl} and follow the given instructions or ask for help.`;
        case 'update/module-update-failed-3': return '[update] Please contact the module author.';
        case 'update/finished': return '[update] Auto-update complete!';

        case 'self-update/warning-disabled': return '[self-update] WARNING: Noctenium Elixir updates are disabled, you will not receive fixes or new versions!';
        case 'self-update/up-to-date': return '[self-update] Noctenium Elixir is up to date';
        case 'self-update/downloading': return `[self-update] Update available (${tokens.from} -> ${tokens.to}), downloading ${tokens.count} file(s)`;
        case 'self-update/download-file': return `[self-update] - Download ${tokens.file}`;
        case 'self-update/applied': return `[self-update] Noctenium Elixir was updated (${tokens.from} -> ${tokens.to})`;
        case 'self-update/failed': return `[self-update] ERROR: Failed to update Noctenium Elixir, continuing with the installed version. Reason: ${tokens.message}`;
        case 'self-update/rolled-back': return `[self-update] WARNING: Version ${tokens.version} did not start correctly and was rolled back. It will be skipped.`;
        case 'self-update/skipping-bad-version': return `[self-update] Skipping version ${tokens.version}, it failed to start on this machine`;
        case 'self-update/other-instance': return '[self-update] Another Noctenium Elixir window is already updating';

        // gui
        case 'gui/tooltip/download': return 'Download';
        case 'gui/tooltip/delete': return 'Delete';
        case 'gui/tooltip/enable': return 'Enable';
        case 'gui/tooltip/disable': return 'Disable';
        case 'gui/tooltip/enableUpdates': return 'Enable Auto Updates';
        case 'gui/tooltip/disableUpdates': return 'Disable Auto Updates';
        case 'gui/tooltip/remove': return 'Remove mod';
        case 'gui/tooltip/toggleMod': return 'Enable/disable mod';
        case 'gui/tooltip/toggleModAutoupdate': return 'Enable/disable mod autoupdate';
        case 'gui/tooltip/donate': return 'Donate to author';
        case 'gui/tooltip/supportLink': return 'Visit mod support page';
        case 'gui/tooltip/readme': return 'Open file with information';

        case 'gui/main/title': return 'Noctenium Elixir';
        
        case 'gui/main/start-stop-proxy-running': return 'Stop';
        case 'gui/main/start-stop-proxy-not-running': return 'Start';
        case 'gui/main/start-stop-proxy-starting': return 'Starting...';
        case 'gui/main/start-stop-proxy-stopping': return 'Stopping...';

        case 'gui/main/status-proxy-running': return 'Running';
        case 'gui/main/status-proxy-not-running': return 'Not Running';

        case 'gui/main/bridge-status/ok': return 'Bridge connected';
        case 'gui/main/bridge-status/pending': return 'Bridge waiting for the game';
        case 'gui/main/bridge-status/fail': return 'Bridge failed to start';
        case 'gui/main/bridge-status/stopped': return 'Bridge stopped';

        case 'gui/main/modal/buttons/ok': return 'OK';
        case 'gui/main/modal/buttons/yes': return 'Yes';
        case 'gui/main/modal/buttons/no': return 'No';
        case 'gui/main/modal/confirm-uninstall-mod': return 'Delete this mod? This cannot be undone.';
        case 'gui/main/modal/warn-mod-update-disabled': return 'Warning! You disabled automatic updates for all of your mods. This will break things at some point. We will not provide any assistance unless re-enabled!';
        case 'gui/main/modal/warn-self-update-disabled': return 'Warning! You disabled automatic updates for Noctenium Elixir itself. You will miss fixes and new versions until you re-enable them.';
        case 'gui/main/modal/error-cannot-install-mod-while-running': return 'You cannot install mods while Noctenium Elixir is running. Please stop it first!';
        case 'gui/main/modal/error-cannot-uninstall-mod-while-running': return 'You cannot uninstall mods while Noctenium Elixir is running. Please stop it first!';
        case 'gui/main/modal/error-bridge-while-running': return 'Stop Noctenium Elixir before installing or uninstalling the game-side bridge.';
        case 'gui/main/modal/confirm-bridge-uninstall': return 'Remove the game-side bridge from your Binaries folder?';
        case 'gui/main/modal/set-gamebinaries': return 'Almost there. Open Settings -> Noctenium bridge and set your Game Binaries folder to the "Binaries" folder of your Europe Classic+ install (the one that contains noctenium.exe), then install the bridge.';
        case 'gui/main/modal/bridge-installed': return 'Game-side bridge installed. Start Noctenium Elixir, then launch the game.';
        case 'gui/main/modal/bridge-uninstalled': return 'Game-side bridge removed from your Binaries folder.';
        case 'gui/main/modal/bridge-failed': return tokens.output ? `The game-side bridge failed:\n\n${tokens.output}` : 'The game-side bridge failed. Check the log.';

        case 'gui/main/static/tabs/log/title': return 'Log';
        case 'gui/main/static/tabs/log/loading': return 'Loading proxy log...';

        case 'gui/main/static/tabs/mods/title': return 'My Mods';
        case 'gui/main/static/tabs/mods/loading': return 'Loading installed mods...';
        case 'gui/main/static/tabs/mods/view/list': return 'List view';
        case 'gui/main/static/tabs/mods/view/card': return 'Card view';

        case 'gui/moddetail/back': return 'Back';
        case 'gui/moddetail/version': return 'Version';
        case 'gui/moddetail/author': return 'Author';
        case 'gui/moddetail/keywords': return 'Keywords';
        case 'gui/moddetail/viewgithub': return 'View on GitHub';
        case 'gui/moddetail/readme-loading': return 'Loading README...';
        case 'gui/moddetail/readme-unavailable': return 'README unavailable.';

        case 'gui/main/static/tabs/newmods/title': return 'Get More Mods';
        case 'gui/main/static/tabs/newmods/loading': return 'Loading list of mods...';
        case 'gui/main/static/tabs/newmods/content/filter': return 'Filter: ';
        case 'gui/main/static/tabs/newmods/content/filter/keywords': return 'Keywords';

        case 'gui/main/static/tabs/settings/title': return 'Settings';
        case 'gui/main/static/tabs/settings/toolbox': return 'Noctenium Elixir';
        case 'gui/main/static/tabs/settings/loading': return 'Loading settings...';
        case 'gui/main/static/tabs/settings/content/version': return 'Version';
        case 'gui/main/static/tabs/settings/content/uilanguage': return 'Language';
        case 'gui/main/static/tabs/settings/content/uilanguage/description': return 'Display language for the Noctenium Elixir interface.';
        case 'gui/main/static/tabs/settings/content/theme': return 'Theme';
        case 'gui/main/static/tabs/settings/content/theme/description': return 'Colour scheme for the Noctenium Elixir window.';
        case 'gui/main/static/tabs/settings/content/autostart': return 'Autostart';
        case 'gui/main/static/tabs/settings/content/autostart/description': return 'Start the proxy automatically when Noctenium Elixir opens.';
        case 'gui/main/static/tabs/settings/content/updatelog': return 'Detailed Update Log';
        case 'gui/main/static/tabs/settings/content/updatelog/description': return 'Print each file checked and downloaded during mod updates.';
        case 'gui/main/static/tabs/settings/content/logtimes': return 'Show Timestamps in Log';
        case 'gui/main/static/tabs/settings/content/logtimes/description': return 'Prefix every log line with a timestamp.';
        case 'gui/main/static/tabs/settings/content/minimizetotray': return 'Minimise to System Tray';
        case 'gui/main/static/tabs/settings/content/minimizetotray/description': return 'Hide to the system tray instead of the taskbar when minimised.';

        case 'gui/main/static/tabs/settings/noctenium': return 'Noctenium Bridge';
        case 'gui/main/static/tabs/settings/content/noctenium/gamebinaries': return 'Game Binaries Folder';
        case 'gui/main/static/tabs/settings/content/noctenium/gamebinaries/description': return 'Select the Classic+ "Binaries" folder, which contains "noctenium.exe." This is reqired to install the game-side bridge.';
        case 'gui/main/static/tabs/settings/content/noctenium/browse': return 'Browse';
        case 'gui/main/static/tabs/settings/content/noctenium/clientinterface': return 'Enable ClientInterface Support';
        case 'gui/main/static/tabs/settings/content/noctenium/clientinterface/description': return 'Inject the ClientInterface DLL for DataCenter query support. Recommended: Enabled. Mods that query the DataCenter won\'t work otherwise.';
        case 'gui/main/static/tabs/settings/content/noctenium/version': return 'Noctenium Bridge Version';
        case 'gui/main/static/tabs/settings/content/noctenium/bridge': return 'Manage Game-side Bridge';
        case 'gui/main/static/tabs/settings/content/noctenium/bridge/description': return 'Copies the preload into your Binaries folder and hooks it into bunfig.toml.';
        case 'gui/main/static/tabs/settings/content/noctenium/install': return 'Install / Update';
        case 'gui/main/static/tabs/settings/content/noctenium/uninstall': return 'Uninstall';
        case 'gui/main/static/tabs/settings/content/noctenium/working': return 'Working...';

        case 'gui/main/static/tabs/settings/advanced': return 'Advanced';
        case 'gui/main/static/tabs/settings/content/noctenium/ipcport': return 'Bridge IPC port';
        case 'gui/main/static/tabs/settings/content/noctenium/ipcport/description': return 'Local loopback port the game preload connects to. Reinstall the game-side bridge after changing this.';
        case 'gui/main/static/tabs/settings/content/noctenium/packettimeout': return 'Packet Timeout (ms)';
        case 'gui/main/static/tabs/settings/content/noctenium/packettimeout/description': return 'How long the game waits for a mod result per packet before passing it through untouched.';
        case 'gui/main/static/tabs/settings/content/noctenium/activationtimeout': return 'Activation Timeout (ms)';
        case 'gui/main/static/tabs/settings/content/noctenium/activationtimeout/description': return 'Longer first-packet timeout used only while mods are still starting up.';
        case 'gui/main/static/tabs/settings/content/devmode': return 'Enable Developer Mode';
        case 'gui/main/static/tabs/settings/content/devmode/description': return 'Enable developer-only features and verbose module errors.';
        case 'gui/main/static/tabs/settings/content/cleanstart': return 'Clean Log on Start';
        case 'gui/main/static/tabs/settings/content/cleanstart/description': return 'Automatically clear the log panel when Noctenium Elixir starts.';
        case 'gui/main/static/tabs/settings/content/noupdate': return 'Disable Mod Updates';
        case 'gui/main/static/tabs/settings/content/noupdate/description': return 'Stop Noctenium Elixir from downloading mod updates on startup, regardless of per-mod status. Not recommended.';
        case 'gui/main/static/tabs/settings/content/noselfupdate': return 'Disable Noctenium Elixir Updates';
        case 'gui/main/static/tabs/settings/content/noselfupdate/description': return 'Stop Noctenium Elixir from updating itself on startup. Not recommended.';

        case 'gui/main/static/tabs/help/title': return 'Need Help?';

        case 'gui/main/static/tabs/modsfolder/title': return 'Show Mods Folder';

        case 'gui/main/static/tabs/credits/title': return 'Credits & Special Thanks';
        case 'gui/main/static/tabs/credits/loading': return 'Loading credits...';
        case 'gui/main/static/tabs/credits/content': return 'Credits & Special Thanks<br /><b>Toolbox+ & Noctenium Elixir:</b> AnEmanator<br /><b>Toolbox:</b> Caali, Salty, Mathicha, Pentagon<br /><b>Logo:</b> Foglio<br /><b>Proxy:</b> Meishu<br />All Toolbox Translators<br />All Mod Developers<br />You!';

        // client-interface
        case 'client-interface/index/communication-error': return '[elixir] Error communicating with client:';
        case 'client-interface/index/peer-rejected': return `[elixir] Rejected client interface connection from PID ${tokens.pid} (${tokens.image}) - not an injected game client. Set "interface_verify_peer": false in config.json to disable this check.`;
        case 'client-interface/index/peer-verify-unavailable': return '[elixir] WARNING: Client interface peer verification is unavailable (scanner build is out of date); connections are not being verified.';

        case 'client-interface/gpkmanager/symlink-warning-1': return '[elixir] WARNING: It looks like either Noctenium Elixir or the game are located on a drive / partition that does';
        case 'client-interface/gpkmanager/symlink-warning-2': return '[elixir] WARNING: not support symbolic links (for example because it is formatted using exFAT or FAT32)!';
        case 'client-interface/gpkmanager/symlink-warning-3': return '[elixir] WARNING: As a fallback, your client mods will be installed by creating file copies instead.';
        case 'client-interface/gpkmanager/symlink-warning-4': return '[elixir] WARNING: Note that this might slow down your client startup time and put strain on your disk!';
        case 'client-interface/gpkmanager/uninstall-error-1': return '[elixir] WARNING: Unable to remove the following client mod file:';
        case 'client-interface/gpkmanager/uninstall-error-2': return `[elixir] WARNING: ${tokens.fullPath}`;
        case 'client-interface/gpkmanager/uninstall-error-3': return '[elixir] WARNING: It will be deleted next time you start the game, instead. You can also delete it manually.';

        // mod
        case 'mod/prefix-log': return `[${tokens.name}]`;
        case 'mod/prefix-warn': return `[${tokens.name}] WARNING:`;
        case 'mod/prefix-error': return `[${tokens.name}] ERROR:`;
        case 'mod/settings-load-error-corrupted-1': return 'You closed the program improperly the last time you were using it!';
        case 'mod/settings-load-error-corrupted-2': return `This caused the settings for module "${tokens.name}" to become corrupted!`;
        case 'mod/settings-load-error-corrupted-3': return 'The module will load default settings now, so adjust them according to your needs.';
        case 'mod/settings-load-error-corrupted-4': return 'Please remember to close the program properly: first close the game, then close Noctenium Elixir using the X button!';
        case 'mod/settings-load-error-corrupted-5': return 'Do not shut down your computer while Noctenium Elixir is running!';
        case 'mod/settings-load-error-invalid-format-1': return `Invalid settings format for module "${tokens.name}"!`;
        case 'mod/settings-load-error-invalid-format-2': return 'This means that you broke it when manually editing it.';
        case 'mod/settings-load-error-invalid-format-3': return 'Please fix the settings file manually or delete it so that default settings can be restored.';
        case 'mod/settings-load-error-invalid-format-4': return '------------------------------------------';
        case 'mod/settings-load-error-invalid-format-5': return 'Advanced error details';
        case 'mod/settings-load-error-invalid-format-6': return 'The full path to the file is:';
        case 'mod/settings-load-error-invalid-format-7': return `  ${tokens.settingsFile}`;
        case 'mod/settings-load-error-invalid-format-8': return 'The full error message is:';
        case 'mod/settings-load-error-invalid-format-9': return `  ${tokens.e}`;
        case 'mod/settings-load-error-invalid-format-10': return '------------------------------------------';
        case 'mod/settings-save-error-write': return 'Unable to store settings! The full error message is:';
        case 'mod/settings-save-error-stringify': return 'Unable to serialise settings! The full error message is:';
        case 'mod/settings-migrate-error-load-migrator': return 'Unable to load settings migrator! The full error message is:';
        case 'mod/settings-migrate-error-run-migrator': return 'An error occurred while migrating the settings! The full error message is:';
        case 'mod/game-state-not-loaded': return 'This mod might malfunction, because "tera-game-state" could not be loaded.';
        case 'mod/client-install-error-1': return `An error occurred while installing the client components!`;
        case 'mod/client-install-error-2': return tokens.supportUrl ? `Please contact the module's author: ${tokens.supportUrl}` : `Please contact the module's author.`;
        
        case 'mod/mod-preloaded': return `[mods] Preloaded module ${tokens.name}`;
        case 'mod/mod-preload-error-1': return `[mods] ERROR: Module ${tokens.name} could not be preloaded!`;
        case 'mod/mod-preload-error-2': return tokens.supportUrl ? `[mods] ERROR: Please contact the module's author: ${tokens.supportUrl}` : `[mods] ERROR: Please contact the module's author.`;
        case 'mod/mod-unloaded': return `[mods] Unloaded module ${tokens.name}`;
        case 'mod/mod-reloaded': return `[mods] Reloaded module ${tokens.name}`;
        
        case 'mod/mod-global-instance-loaded': return `[mods] Started module ${tokens.name}`;
        case 'mod/mod-global-instance-load-error-1': return `[mods] ERROR: Module ${tokens.name} could not be started!`;
        case 'mod/mod-global-instance-load-error-2': return tokens.supportUrl ? `[mods] ERROR: Please contact the module's author: ${tokens.supportUrl}` : `[mods] ERROR: Please contact the module's author.`;
        case 'mod/mod-global-instance-unloaded': return `[mods] Stopped module ${tokens.name}`;
        case 'mod/mod-global-instance-unload-error-1': return `[mods] ERROR: Module ${tokens.name} could not be stopped!`;
        case 'mod/mod-global-instance-unload-error-2': return tokens.supportUrl ? `[mods] ERROR: Please contact the module's author: ${tokens.supportUrl}` : `[mods] ERROR: Please contact the module's author.`;
        
        case 'mod/mod-client-instance-loaded': return `[mods] Connected module ${tokens.name} to client`;
        case 'mod/mod-client-instance-load-error-1': return `[mods] ERROR: Module ${tokens.name} could not be connected to client!`;
        case 'mod/mod-client-instance-load-error-2': return tokens.supportUrl ? `[mods] ERROR: Please contact the module's author: ${tokens.supportUrl}` : `[mods] ERROR: Please contact the module's author.`;
        case 'mod/mod-client-instance-unloaded': return `[mods] Disconnected module ${tokens.name} from client`;
        case 'mod/mod-client-instance-unload-error-1': return `[mods] ERROR: Module ${tokens.name} could not be disconnected from client!`;
        case 'mod/mod-client-instance-unload-error-2': return tokens.supportUrl ? `[mods] ERROR: Please contact the module's author: ${tokens.supportUrl}` : `[mods] ERROR: Please contact the module's author.`;
        
        case 'mod/mod-network-instance-loaded': return `[mods] Applied module ${tokens.name} to server connection`;
        case 'mod/mod-network-instance-load-error-1': return `[mods] ERROR: Module ${tokens.name} could not be applied to server connection!`;
        case 'mod/mod-network-instance-load-error-2': return tokens.supportUrl ? `[mods] ERROR: Please contact the module's author: ${tokens.supportUrl}` : `[mods] ERROR: Please contact the module's author.`;
        case 'mod/mod-network-instance-unloaded': return `[mods] Removed module ${tokens.name} from server connection`;
        case 'mod/mod-network-instance-unload-error-1': return `[mods] ERROR: Module ${tokens.name} could not be removed from server connection!`;
        case 'mod/mod-network-instance-unload-error-2': return tokens.supportUrl ? `[mods] ERROR: Please contact the module's author: ${tokens.supportUrl}` : `[mods] ERROR: Please contact the module's author.`;

        // mod-manager
        case 'mod-manager/load-module-info-error': return `[mods] ERROR: Unable to load module information for "${tokens.name}"! The full error message is:`;
        case 'mod-manager/duplicate-mod-error': return `[mods] ERROR: Duplicate module "${tokens.name}" detected!`;
        case 'mod-manager/missing-mod-dependency-error': return `[mods] ERROR: Module ${tokens.name} requires "${tokens.dependency}" to be installed, but it is not!`;
        case 'mod-manager/mod-conflict-error': return `[mods] ERROR: Module ${tokens.name} cannot be loaded while "${tokens.conflict}" is installed!`;
        case 'mod-manager/cannot-load-mod-not-installed': return `[mods] ERROR: Trying to load module that is not installed: ${tokens.name}`;
        case 'mod-manager/cannot-unload-mod-not-installed': return `[mods] ERROR: Trying to unload module that is not installed: ${tokens.name}`;
        case 'mod-manager/cannot-unload-mod-not-loaded': return `[mods] ERROR: Trying to unload module that is not loaded: ${tokens.name}`;
        case 'mod-manager/cannot-reload-mod-not-installed': return `[mods] ERROR: Trying to reload module that is not installed: ${tokens.name}`;
        case 'mod-manager/cannot-reload-mod-not-supported': return `[mods] ERROR: Trying to reload module that does not support hot reloading: ${tokens.name}`;
        case 'mod-manager/cannot-reload-mod-not-loaded': return `[mods] ERROR: Trying to reload module that is not loaded: ${tokens.name}`;

        // deprecation warnings (emitted via warnDeprecated in this package; tokens: old, new, mod)
        case 'deprecated/package': return `[mods] "${tokens.old}" package is deprecated, use "${tokens.new}"${tokens.mod ? ` ("${tokens.mod}")` : ''}`;
        case 'deprecated/subpath': return `[mods] "${tokens.old}" path is deprecated, use "${tokens.new}"${tokens.mod ? ` ("${tokens.mod}")` : ''}`;
        case 'deprecated/module-json-field': return `[mods] "${tokens.old}" is deprecated, use "${tokens.new}"${tokens.mod ? ` ("${tokens.mod}", module.json)` : ''}`;
        case 'deprecated/global-teraproxy': return `[mods] "global.TeraProxy" is deprecated, use "global.Toolbox"${tokens.mod ? ` ("${tokens.mod}")` : ''}`;
        case 'deprecated/global-uilanguage': return `[mods] "global.Toolbox.UILanguage" is deprecated, use require('@anemanator/toolbox-mui').language${tokens.mod ? ` ("${tokens.mod}")` : ''}`;

        // default
        default: throw new Error(`Invalid string "${str}"!`);
    }
};

module.exports = { Name, GetString };
