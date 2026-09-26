const { ipcRenderer, shell } = require('electron');
const { ToolboxMUI, LanguageNames } = require('@anemanator/toolbox-mui');
const { renderMarkdown } = require('./js/markdown');
const { resolveKeywords, AllowedKeywords } = require('../mod-keywords');
const Themes = ['elixir-dark', 'elixir-light'];
const ThemeNames = { 'elixir-dark': 'Elixir Dark', 'elixir-light': 'Elixir Light' };
const fs = require('fs');

let mui = null;

function displayName(modInfo) {
    if (modInfo.options) {
        if (modInfo.options.guiName) return modInfo.options.guiName;
        if (modInfo.options.cliName) return modInfo.options.cliName;
    }

    return modInfo.rawName || modInfo.name;
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatAuthors(author) {
    return Array.isArray(author) ? author.join(', ') : author || '';
}

jQuery($ => {
    const contents = $('#log-contents');

    // hard cap on log lines so a spamming mod can't grow the DOM until the window hangs
    const MAX_LOG_LINES = 5000;
    let logScrollQueued = false;

    // --------------------------------------------------------------------
    // --------------------------- MAIN BASIC CONTROLS --------------------
    // --------------------------------------------------------------------

    // MUI
    function setLanguage(language) {
        if (mui && language && mui.language === language) return;

        mui = new ToolboxMUI(language);
        $('*').each(function () {
            const str = $(this).attr('mui');
            if (str) {
                $(this).text(mui.get(str));
            } else {
                const str_html = $(this).attr('mui-html');
                if (str_html) $(this).html(mui.get(str_html));
            }
        });
    }

    // --------------------------------------------------------------------
    // ----------------------------- MAIN ---------------------------------
    // --------------------------------------------------------------------
    $('#minimize-btn').click(() => {
        ipcRenderer.send('window-control', Settings.gui.minimizetotray ? 'hide' : 'minimize');
    });

    $('#close-btn').click(() => {
        ipcRenderer.send('window-control', 'close');
    });

    $('#info-btn').click(() => {
        ShowModalHtml(mui.get('gui/main/static/tabs/credits/content'));
    });

    $('#mods-btn').click(() => {
        ipcRenderer.send('show mods folder');
    });

    // Disable mouse wheel clicks
    $(document).on('auxclick', 'a', e => {
        if (e.which !== 2) return true;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    });

    // --------------------------------------------------------------------
    // ------------------------- SETTINGS TAB -----------------------------
    // --------------------------------------------------------------------
    let Settings = null;

    function onSettingsChanged(newSettings) {
        Settings = newSettings;
        setLanguage(Settings.uilanguage);
        setProxyRunning(ProxyRunning);

        $('#uilanguage').val(mui.language);
        $('#uithemes').val(Settings.gui.theme);
        $('#autostart').prop('checked', Settings.gui.autostart);
        $('#updatelog').prop('checked', Settings.updatelog);
        $('#logtimes').prop('checked', Settings.gui.logtimes);
        $('#noupdate').prop('checked', Settings.noupdate);
        $('#noselfupdate').prop('checked', Settings.noselfupdate);
        $('#devmode').prop('checked', Settings.devmode);
        $('#minimizetotray').prop('checked', Settings.gui.minimizetotray);
        $('#cleanstart').prop('checked', Settings.gui.cleanstart);
        const theme = Themes.includes(Settings.gui.theme) ? Settings.gui.theme : 'elixir-dark';
        $('#theme').attr('href', `css/themes/${theme}.css`);

        const nox = Settings.noctenium || {};
        $('#nox-gamebinaries').val(nox.gameBinaries || '');
        $('#nox-clientinterface').prop('checked', nox.clientInterface !== false);
        $('#nox-ipcport').val(nox.ipcPort || 9260);
        $('#nox-packettimeout').val(nox.packetTimeoutMs || 100);
        $('#nox-activationtimeout').val(nox.activationTimeoutMs || 1000);
        updateBridgeButtons();

        ModsDisplayMode = Settings.gui.modsDisplayMode || 'card';
        InstallDisplayMode = Settings.gui.getMoreModsDisplayMode || 'card';
        $('#mods-view-list, #newmods-view-list').attr('aria-label', mui.get('gui/main/static/tabs/mods/view/list'));
        $('#mods-view-card, #newmods-view-card').attr('aria-label', mui.get('gui/main/static/tabs/mods/view/card'));
    }

    function updateSettings(newSettings) {
        ipcRenderer.send('set config', newSettings);
        onSettingsChanged(newSettings);
    }

    function updateSetting(key, value) {
        let Override = {};
        Override[key] = value;
        updateSettings(Object.assign(Settings, Override));
    }

    function updateGUISetting(key, value) {
        let Override = {};
        Override[key] = value;

        let SettingsCopy = { ...Settings };
        SettingsCopy.gui = Object.assign(SettingsCopy.gui, Override);
        updateSettings(SettingsCopy);
    }

    function updateNocteniumSetting(key, value) {
        let SettingsCopy = { ...Settings };
        SettingsCopy.noctenium = Object.assign({}, SettingsCopy.noctenium, { [key]: value });
        updateSettings(SettingsCopy);
    }

    // Bridge install/uninstall need a Game Binaries folder and no running proxy.
    let BridgeBusy = false;
    function updateBridgeButtons() {
        const haveGb = !!(Settings && Settings.noctenium && Settings.noctenium.gameBinaries);
        const blocked = !haveGb || BridgeBusy || ProxyStarting || ProxyRunning;
        $('#nox-install, #nox-uninstall').prop('disabled', blocked);
    }

    function loadSettingsLanguageNames() {
        const LanguageSelector = $('#uilanguage');
        Object.keys(LanguageNames).forEach(language_id =>
            LanguageSelector.append($('<option/>', { value: language_id, text: LanguageNames[language_id] }))
        );
    }

    function loadThemesNames() {
        const ThemesSelector = $('#uithemes');
        Themes.forEach(theme =>
            ThemesSelector.append($('<option/>', { value: theme, text: ThemeNames[theme] || theme }))
        );
    }

    loadSettingsLanguageNames();
    loadThemesNames();

    $('#appversion').text(require('../../package.json').version);

    ipcRenderer.on('bridge version', (_, v) => $('#nox-version').text(v));

    // one-shot nudge on launch if the Game Binaries folder was never set
    let GbPromptShown = false;
    ipcRenderer.on('bridge state', (_, state) => {
        if (!GbPromptShown && state && !state.gameBinaries) {
            GbPromptShown = true;
            ShowModal(mui.get('gui/main/modal/set-gamebinaries'));
        }
        updateBridgeButtons();
    });

    ipcRenderer.on('bridge result', (_, r) => {
        BridgeBusy = false;
        $('#nox-install').text(mui.get('gui/main/static/tabs/settings/content/noctenium/install'));
        $('#nox-uninstall').text(mui.get('gui/main/static/tabs/settings/content/noctenium/uninstall'));
        updateBridgeButtons();
        if (r.reason === 'running' || r.reason === 'no-gamebinaries') return; // already blocked in UI
        if (r.ok)
            ShowModal(
                mui.get(
                    r.action === 'install' ? 'gui/main/modal/bridge-installed' : 'gui/main/modal/bridge-uninstalled'
                )
            );
        else ShowModal(mui.get('gui/main/modal/bridge-failed', { output: r.output || '' }));
    });

    ipcRenderer.on('set config', (_, newConfig) => {
        onSettingsChanged(newConfig);
    });

    // UI events
    $('#uilanguage').change(() => {
        updateSetting('uilanguage', $('#uilanguage').val());
    });

    $('#uithemes').change(() => {
        updateGUISetting('theme', $('#uithemes').val());
    });

    $('#autostart').click(() => {
        updateGUISetting('autostart', $('#autostart').is(':checked'));
    });

    $('#updatelog').click(() => {
        updateSetting('updatelog', $('#updatelog').is(':checked'));
    });

    $('#logtimes').click(() => {
        updateGUISetting('logtimes', $('#logtimes').is(':checked'));
    });

    $('#noupdate').click(() => {
        const checked = $('#noupdate').is(':checked');
        if (checked) ShowModal(mui.get('gui/main/modal/warn-mod-update-disabled'));
        updateSetting('noupdate', checked);
    });

    $('#noselfupdate').click(() => {
        const checked = $('#noselfupdate').is(':checked');
        if (checked) ShowModal(mui.get('gui/main/modal/warn-self-update-disabled'));
        updateSetting('noselfupdate', checked);
    });

    $('#devmode').click(() => {
        updateSetting('devmode', $('#devmode').is(':checked'));
    });

    $('#minimizetotray').click(() => {
        updateGUISetting('minimizetotray', $('#minimizetotray').is(':checked'));
    });

    $('#cleanstart').click(() => {
        updateGUISetting('cleanstart', $('#cleanstart').is(':checked'));
    });

    // Noctenium Elixir bridge settings
    $('#nox-browse').click(async () => {
        const picked = await ipcRenderer.invoke('open-dialog', {
            properties: ['openDirectory'],
            title: mui.get('gui/main/static/tabs/settings/content/noctenium/gamebinaries')
        });
        if (picked && !picked.canceled && picked.filePaths && picked.filePaths[0]) {
            $('#nox-gamebinaries').val(picked.filePaths[0]);
            updateNocteniumSetting('gameBinaries', picked.filePaths[0]);
        }
    });

    $('#nox-gamebinaries').change(() => {
        updateNocteniumSetting('gameBinaries', $('#nox-gamebinaries').val().trim() || null);
    });

    $('#nox-clientinterface').click(() => {
        updateNocteniumSetting('clientInterface', $('#nox-clientinterface').is(':checked'));
    });

    $('#nox-ipcport').change(() => {
        updateNocteniumSetting('ipcPort', Number($('#nox-ipcport').val()) || 9260);
    });

    $('#nox-packettimeout').change(() => {
        updateNocteniumSetting('packetTimeoutMs', Number($('#nox-packettimeout').val()) || 100);
    });

    $('#nox-activationtimeout').change(() => {
        updateNocteniumSetting('activationTimeoutMs', Number($('#nox-activationtimeout').val()) || 1000);
    });

    function runBridge(action) {
        if (BridgeBusy || ProxyStarting || ProxyRunning) return;
        BridgeBusy = true;
        const busyText = mui.get('gui/main/static/tabs/settings/content/noctenium/working');
        $('#nox-install, #nox-uninstall').text(busyText).prop('disabled', true);
        ipcRenderer.send(action === 'install' ? 'bridge install' : 'bridge uninstall');
    }

    $('#nox-install').click(() => runBridge('install'));

    $('#nox-uninstall').click(() => {
        if (BridgeBusy || ProxyStarting || ProxyRunning) return;
        ShowConfirm(mui.get('gui/main/modal/confirm-bridge-uninstall'), () => runBridge('uninstall'));
    });

    // Admin indicator
    let IsAdmin = false;
    ipcRenderer.on('is admin', (_, isAdmin) => {
        IsAdmin = isAdmin;

        if (IsAdmin) {
            $('#admin-badge').removeClass('admin-badge-disabled');
            $('#admin-badge').addClass('admin-badge-enabled');
        } else {
            $('#admin-badge').removeClass('admin-badge-enabled');
            $('#admin-badge').addClass('admin-badge-disabled');
        }
    });

    // Proxy control
    let ProxyRunning = false;
    let ProxyStarting = false;

    function setProxyStarting() {
        ProxyStarting = true;
        $('#startproxy').text(mui.get('gui/main/start-stop-proxy-starting'));
        setBridgeStatus('pending');
        updateBridgeButtons();
    }

    function setProxyRunning(running) {
        // note: a "running: false" arriving mid-start means the start failed - fall through and reset the button

        ProxyRunning = running;
        ProxyStarting = false;

        $('#startproxy').text(
            mui.get(ProxyRunning ? 'gui/main/start-stop-proxy-running' : 'gui/main/start-stop-proxy-not-running')
        );
        $('#title-status').text(
            mui.get(ProxyRunning ? 'gui/main/status-proxy-running' : 'gui/main/status-proxy-not-running')
        );
        if (!ProxyRunning) setBridgeStatus('stopped');
        updateBridgeButtons();
    }

    // bridge status light: green = preload connected, yellow = listening/starting, red = failed
    function setBridgeStatus(state) {
        const cls = { ok: 'is-ok', pending: 'is-pending', fail: 'is-fail' }[state] || '';
        $('#bridge-status')
            .removeClass('is-ok is-pending is-fail')
            .addClass(cls)
            .attr('aria-label', mui.get(`gui/main/bridge-status/${state}`));
    }

    function selectLogForcefully() {
        document.getElementById('tabone').checked = true;
        const tabs = document.querySelectorAll('.tab--active');
        for (const tab of tabs) tab.classList.remove('tab--active');
        const contentElement = document.querySelector('.tab[data-tab="1"]');
        contentElement.classList.add('tab--active');
    }

    function startProxyLogJob() {
        if (Settings.gui.cleanstart) $('#log-contents').empty();
    }

    function startProxy() {
        if (ProxyStarting || ProxyRunning) return;

        setProxyStarting();
        ipcRenderer.send('start proxy');

        selectLogForcefully();
        startProxyLogJob();
    }

    function stopProxy() {
        if (!ProxyRunning) return;

        $('#startproxy').text(mui.get('gui/main/start-stop-proxy-stopping'));
        ipcRenderer.send('stop proxy');
    }

    $('#startproxy-btn').click(() => {
        if (ProxyRunning) stopProxy();
        else startProxy();
    });

    ipcRenderer.on('proxy starting', _ => setProxyStarting());
    ipcRenderer.on('proxy running', (_, running) => setProxyRunning(running));
    ipcRenderer.on('bridge status', (_, state) => setBridgeStatus(state));

    // ---------------------------------------------------------------------
    // ------------------------ LOGS ---------------------------------------
    // ---------------------------------------------------------------------
    function log(msg, type) {
        let timeStr = '';
        if (Settings.gui.logtimes) {
            const now = new Date();
            timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}] `;
        }

        const el = contents[0];
        // only auto-follow if the user is already parked near the bottom
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;

        contents.append($('<div/>', { class: type || 'log' }).text(`${timeStr}${msg}`));

        while (el.childElementCount > MAX_LOG_LINES) el.removeChild(el.firstElementChild);

        // coalesce the scroll into one rAF instead of forcing a reflow every line
        if (nearBottom && !logScrollQueued) {
            logScrollQueued = true;
            requestAnimationFrame(() => {
                logScrollQueued = false;
                el.scrollTop = el.scrollHeight;
            });
        }
    }

    $('#clear-logs').click(() => {
        $('#log-contents').empty();
    });

    $('#save-logs').click(() => {
        ipcRenderer
            .invoke('save-dialog', {
                title: 'Select the File Path to save',
                // defaultPath: path.join(__dirname, '../assets/'),
                buttonLabel: 'Save File',
                // Restricting the user to only Text Files.
                filters: [
                    {
                        name: 'Text Files',
                        extensions: ['log']
                    }
                ],
                properties: []
            })
            .then(file => {
                if (!file.canceled) {
                    // Creating and Writing to the sample.txt file
                    fs.writeFile(file.filePath.toString(), $('#log-contents').text(), function (err) {
                        if (err) throw err;
                    });
                }
            })
            .catch(err => {
                console.log(err);
            });
    });

    ipcRenderer.on('log', (_, data, type) => {
        log(data.toString(), type);
    });

    // ---------------------------------------------------------------------
    // ------------------------ MODS LIST ----------------------------------
    // ---------------------------------------------------------------------
    let WaitingForModAction = false;
    let ModInfos = [];
    let ModsDisplayMode = 'card';
    let OpenModName = null; // name of the mod whose detail view is open, or null

    function actionButton(action, tooltipKey, iconClass, extraClass, position) {
        return `<div class="mod-action-button${extraClass ? ' ' + extraClass : ''}" data-action="${action}" role="tooltip" data-microtip-position="${position || 'top-left'}" aria-label="${escapeHtml(mui.get(tooltipKey))}"><i class="mdi ${iconClass}"></i></div>`;
    }

    // list rows sit against the top of the scroller, so their tooltips point down to
    // avoid being clipped by / hidden behind the view-toggle bar
    function controlsTooltipPos(mode) {
        return mode === 'list' ? 'bottom-left' : 'top-left';
    }

    function modControls(modInfo, position) {
        const togglable = !modInfo.isCoreModule && modInfo.compatibility === 'compatible';
        let out = '';
        if (togglable && modInfo.canAutoUpdate)
            out += actionButton(
                'toggle-update',
                modInfo.disableAutoUpdate ? 'gui/tooltip/enableUpdates' : 'gui/tooltip/disableUpdates',
                modInfo.disableAutoUpdate ? 'mdi-progress-download' : 'mdi-progress-close',
                modInfo.disableAutoUpdate ? 'mod-action-button--danger' : '',
                position
            );
        if (togglable)
            out += actionButton(
                'toggle-load',
                modInfo.disabled ? 'gui/tooltip/enable' : 'gui/tooltip/disable',
                modInfo.disabled ? 'mdi-flask-outline' : 'mdi-flask-minus-outline',
                modInfo.disabled ? 'mod-action-button--danger' : '',
                position
            );
        if (!modInfo.isCoreModule)
            out += actionButton('delete', 'gui/tooltip/delete', 'mdi-trash-can-outline', '', position);
        return out;
    }

    function keywordPills(modInfo) {
        const tags = resolveKeywords(modInfo).slice(0, 3);
        return `<div class="mod-card-tags">${tags.map(t => `<span class="mod-tag">${escapeHtml(t)}</span>`).join('')}</div>`;
    }

    function modCardMarkup(modInfo, i, controlsHtml) {
        return `
			<div class="mod-card" data-idx="${i}">
				<div class="mod-card-head">
					<div class="mod-card-title">${modInfo.drmKey ? '<span class="mdi mdi-currency-usd"></span> ' : ''}${escapeHtml(displayName(modInfo))}${modInfo.version ? ` <span class="mod-card-ver">(${escapeHtml(modInfo.version)})</span>` : ''}</div>
					<div class="mod-card-sub">${modInfo.author ? 'by ' + escapeHtml(formatAuthors(modInfo.author)) : ''}</div>
				</div>
				<div class="mod-card-foot">
					<div class="mod-card-desc">${escapeHtml(modInfo.description || '')}</div>
					<div class="mod-card-actions">
						${keywordPills(modInfo)}
						<div class="mod-card-controls">${controlsHtml}</div>
					</div>
				</div>
			</div>`;
    }

    function modCard(modInfo, i) {
        return modCardMarkup(modInfo, i, modControls(modInfo, controlsTooltipPos(ModsDisplayMode)));
    }

    function setActiveToggle(listSel, cardSel, mode) {
        $(listSel).toggleClass('is-active', mode === 'list');
        $(cardSel).toggleClass('is-active', mode === 'card');
    }

    function readmeHtmlFor(modInfo) {
        if (!modInfo.readmePath) return '';
        let md = '';
        try {
            md = fs.readFileSync(modInfo.readmePath, 'utf8');
        } catch (_) {
            return '';
        }
        const html = renderMarkdown(md);
        return html == null ? escapeHtml(mui.get('gui/moddetail/readme-unavailable')) : html;
    }

    function modInfoPanel(modInfo, controlsHtml) {
        return `
			<div class="mod-detail-info">
				<div class="mod-detail-row">
					<div><b>${escapeHtml(mui.get('gui/moddetail/version'))}</b><br>${escapeHtml(modInfo.version || '-')}</div>
					<div class="mod-detail-actions">${controlsHtml || ''}</div>
				</div>
				<div><b>${escapeHtml(mui.get('gui/moddetail/author'))}</b><br>${escapeHtml(formatAuthors(modInfo.author) || '-')}</div>
				<div><b>${escapeHtml(mui.get('gui/moddetail/keywords'))}</b><br>${escapeHtml(resolveKeywords(modInfo).join(', '))}</div>
				${modInfo.source ? `<button class="mod-detail-github" data-action="github"><span class="mdi mdi-github"></span> ${escapeHtml(mui.get('gui/moddetail/viewgithub'))}</button>` : ''}
			</div>`;
    }

    function renderModsView() {
        const list = $('#modulesList');
        const detail = $('#modulesDetail');

        if (OpenModName) {
            const modInfo = ModInfos.find(m => m.name === OpenModName);
            if (modInfo) {
                // build first, swap after, so a render error never leaves the tab blank
                const markup = `
					<div class="mod-detail-head">
						<div class="mod-action-button" data-action="back" role="tooltip" data-microtip-position="top-right" aria-label="${escapeHtml(mui.get('gui/moddetail/back'))}"><i class="mdi mdi-arrow-left"></i></div>
						<h2 class="mod-detail-title">${modInfo.drmKey ? '<span class="mdi mdi-currency-usd"></span> ' : ''}${escapeHtml(displayName(modInfo))}</h2>
						<span class="mod-detail-rawname">${escapeHtml(modInfo.rawName || modInfo.name)}</span>
					</div>
					<div class="mod-detail-body">
						<div class="mod-detail-main">
							<p>${escapeHtml(modInfo.description || '')}</p>
							<div class="mod-readme">${readmeHtmlFor(modInfo)}</div>
						</div>
						${modInfoPanel(modInfo, modControls(modInfo))}
					</div>
				`;
                list.hide();
                $('#mods-view-list, #mods-view-card').hide();
                detail.html(markup).show();
                return;
            }
            OpenModName = null;
        }

        detail.hide().empty();
        list.show();
        $('#mods-view-list, #mods-view-card').show();
        list.attr('class', ModsDisplayMode === 'list' ? 'mods-grid mods-grid--list' : 'mods-grid mods-grid--card');
        list.html(ModInfos.map((m, i) => modCard(m, i)).join(''));
        setActiveToggle('#mods-view-list', '#mods-view-card', ModsDisplayMode);
    }

    function handleModAction(action, modInfo) {
        if (!modInfo) return;

        if (action === 'back') {
            OpenModName = null;
            renderModsView();
        } else if (action === 'github') {
            shell.openExternal(modInfo.source);
        } else if (action === 'toggle-load') {
            if (!WaitingForModAction) {
                ipcRenderer.send('toggle mod load', modInfo);
                WaitingForModAction = true;
            }
        } else if (action === 'toggle-update') {
            if (!WaitingForModAction) {
                ipcRenderer.send('toggle mod autoupdate', modInfo);
                WaitingForModAction = true;
            }
        } else if (action === 'delete') {
            if (ProxyStarting || ProxyRunning) {
                ShowModal(mui.get('gui/main/modal/error-cannot-uninstall-mod-while-running'));
            } else {
                ShowConfirm(mui.get('gui/main/modal/confirm-uninstall-mod'), () => {
                    if (!WaitingForModAction) {
                        ipcRenderer.send('uninstall mod', modInfo);
                        WaitingForModAction = true;
                    }
                });
            }
        }
    }

    $('#modulesList').on('click', '.mod-action-button', function (e) {
        e.stopImmediatePropagation();
        handleModAction($(this).data('action'), ModInfos[$(this).closest('.mod-card').data('idx')]);
    });
    $('#modulesList').on('click', '.mod-card', function () {
        OpenModName = ModInfos[$(this).data('idx')].name;
        renderModsView();
    });
    $('#modulesDetail').on('click', '.mod-action-button, .mod-detail-github', function () {
        handleModAction(
            $(this).data('action'),
            ModInfos.find(m => m.name === OpenModName)
        );
    });
    $('#mods-view-list').click(() => {
        ModsDisplayMode = 'list';
        updateGUISetting('modsDisplayMode', 'list');
        renderModsView();
    });
    $('#mods-view-card').click(() => {
        ModsDisplayMode = 'card';
        updateGUISetting('modsDisplayMode', 'card');
        renderModsView();
    });

    // open links inside a rendered readme externally, never navigate the window
    $('#modulesDetail, #installableModulesDetail').on('click', '.mod-readme a', function (e) {
        e.preventDefault();
        const href = $(this).attr('href');
        if (href && /^https?:/i.test(href)) shell.openExternal(href);
    });

    ipcRenderer.on('set mods', (_, modInfos) => {
        WaitingForModAction = false;
        ModInfos = modInfos;
        renderModsView();
    });

    // --------------------------------------------------------------------
    // ---------------------- MODS INSTALLATION TAB -----------------------
    // --------------------------------------------------------------------
    let WaitingForModInstall = false;
    let InstallableModInfos = [];
    let InstallDisplayMode = 'card';
    let OpenInstallName = null;
    const InstallReadmeCache = {};
    let InstallableModFilter = {
        keywords: [],
        categories: []
    };

    function requestInstallMod(modInfo) {
        ipcRenderer.send('install mod', modInfo);
        WaitingForModInstall = true;
    }

    function matchesInstallableModFilter(modInfo) {
        const kw = resolveKeywords(modInfo);
        if (InstallableModFilter.categories.length > 0 && !InstallableModFilter.categories.some(c => kw.includes(c)))
            return false;

        return (
            InstallableModFilter.keywords.length === 0 ||
            InstallableModFilter.keywords.some(
                keyword =>
                    (modInfo.author && formatAuthors(modInfo.author).toLowerCase().includes(keyword)) ||
                    (modInfo.description && modInfo.description.toLowerCase().includes(keyword)) ||
                    displayName(modInfo).toLowerCase().includes(keyword) ||
                    kw.some(k => k.toLowerCase().includes(keyword))
            )
        );
    }

    function installCard(modInfo, i) {
        return modCardMarkup(
            modInfo,
            i,
            actionButton(
                'install',
                'gui/tooltip/download',
                'mdi-cloud-download',
                '',
                controlsTooltipPos(InstallDisplayMode)
            )
        );
    }

    function installReadmeHtml(modInfo) {
        if (!modInfo.source) return '';
        const cached = InstallReadmeCache[modInfo.source];
        if (!cached) return escapeHtml(mui.get('gui/moddetail/readme-loading'));
        if (!cached.ok) return escapeHtml(mui.get('gui/moddetail/readme-unavailable'));
        const html = renderMarkdown(cached.markdown);
        return html == null ? escapeHtml(mui.get('gui/moddetail/readme-unavailable')) : html;
    }

    function rebuildInstallableModsList() {
        const list = $('#installableModulesList');
        const detail = $('#installableModulesDetail');

        if (OpenInstallName) {
            const modInfo = InstallableModInfos.find(m => m.name === OpenInstallName);
            if (modInfo) {
                const markup = `
					<div class="mod-detail-head">
						<div class="mod-action-button" data-action="back" role="tooltip" data-microtip-position="top-right" aria-label="${escapeHtml(mui.get('gui/moddetail/back'))}"><i class="mdi mdi-arrow-left"></i></div>
						<h2 class="mod-detail-title">${escapeHtml(displayName(modInfo))}</h2>
					</div>
					<div class="mod-detail-body">
						<div class="mod-detail-main">
							<p>${escapeHtml(modInfo.description || '')}</p>
							<div class="mod-readme">${installReadmeHtml(modInfo)}</div>
						</div>
						${modInfoPanel(modInfo, actionButton('install', 'gui/tooltip/download', 'mdi-cloud-download'))}
					</div>
				`;
                list.hide();
                $('#newmods-view-list, #newmods-view-card').hide();
                detail.html(markup).show();
                if (modInfo.source && !InstallReadmeCache[modInfo.source])
                    ipcRenderer.send('fetch mod readme', modInfo.source);
                return;
            }
            OpenInstallName = null;
        }

        detail.hide().empty();
        list.show();
        $('#newmods-view-list, #newmods-view-card').show();
        list.attr('class', InstallDisplayMode === 'list' ? 'mods-grid mods-grid--list' : 'mods-grid mods-grid--card');
        list.html(
            InstallableModInfos.filter(matchesInstallableModFilter)
                .map(m => installCard(m, InstallableModInfos.indexOf(m)))
                .join('')
        );
        setActiveToggle('#newmods-view-list', '#newmods-view-card', InstallDisplayMode);
    }

    function handleInstallAction(action, modInfo) {
        if (!modInfo) return;

        if (action === 'back') {
            OpenInstallName = null;
            rebuildInstallableModsList();
        } else if (action === 'github') {
            shell.openExternal(modInfo.source);
        } else if (action === 'install') {
            if (ProxyStarting || ProxyRunning)
                ShowModal(mui.get('gui/main/modal/error-cannot-install-mod-while-running'));
            else if (!WaitingForModInstall) requestInstallMod(modInfo);
        }
    }

    $('#installableModulesList').on('click', '.mod-action-button', function (e) {
        e.stopImmediatePropagation();
        handleInstallAction($(this).data('action'), InstallableModInfos[$(this).closest('.mod-card').data('idx')]);
    });
    $('#installableModulesList').on('click', '.mod-card', function () {
        OpenInstallName = InstallableModInfos[$(this).data('idx')].name;
        rebuildInstallableModsList();
    });
    $('#installableModulesDetail').on('click', '.mod-action-button, .mod-detail-github', function () {
        handleInstallAction(
            $(this).data('action'),
            InstallableModInfos.find(m => m.name === OpenInstallName)
        );
    });
    $('#newmods-view-list').click(() => {
        InstallDisplayMode = 'list';
        updateGUISetting('getMoreModsDisplayMode', 'list');
        rebuildInstallableModsList();
    });
    $('#newmods-view-card').click(() => {
        InstallDisplayMode = 'card';
        updateGUISetting('getMoreModsDisplayMode', 'card');
        rebuildInstallableModsList();
    });

    $('#installableModulesFilterString').on('input', () => {
        InstallableModFilter.keywords = $('#installableModulesFilterString')
            .val()
            .split(',')
            .map(x => x.trim().toLowerCase())
            .filter(x => x.length > 0);
        rebuildInstallableModsList();
    });

    // keyword category filter dropdown
    const kwMenu = $('#installableModulesFilterKeywords .kw-dropdown-menu');
    AllowedKeywords.forEach(cat => {
        kwMenu.append(`<label><input type="checkbox" value="${escapeHtml(cat)}" /> ${escapeHtml(cat)}</label>`);
    });
    kwMenu.on('change', 'input', () => {
        InstallableModFilter.categories = kwMenu
            .find('input:checked')
            .map((_, el) => el.value)
            .get();
        rebuildInstallableModsList();
    });
    $(document).on('click', e => {
        if (!$(e.target).closest('.kw-dropdown').length) $('.kw-dropdown').removeAttr('open');
    });

    ipcRenderer.on('mod readme', (_, data) => {
        InstallReadmeCache[data.source] = data;
        const modInfo = InstallableModInfos.find(m => m.name === OpenInstallName);
        if (modInfo && modInfo.source === data.source) {
            const html = data.ok ? renderMarkdown(data.markdown) : null;
            $('#installableModulesDetail .mod-readme').html(
                html || escapeHtml(mui.get('gui/moddetail/readme-unavailable'))
            );
        }
    });

    ipcRenderer.on('set installable mods', (_, modInfos) => {
        $('#loading').hide();
        $('#installableModulesView').show();
        WaitingForModInstall = false;
        InstallableModInfos = modInfos;
        rebuildInstallableModsList();
    });

    // --------------------------------------------------------------------
    // ---------------------------- MODAL BOX -----------------------------
    // --------------------------------------------------------------------
    let modalConfirmCb = null;

    function ShowModal(text) {
        $('#modalbox-text').text(text);
        $('#modalbox-buttons').hide();
        modalConfirmCb = null;
        $('#modalbox').show();
    }

    function ShowModalHtml(text) {
        $('#modalbox-text').html(text);
        $('#modalbox-buttons').hide();
        modalConfirmCb = null;
        $('#modalbox').show();
    }

    function ShowConfirm(text, onYes) {
        $('#modalbox-text').text(text);
        $('#modalbox-yes').text(mui.get('gui/main/modal/buttons/yes'));
        $('#modalbox-no').text(mui.get('gui/main/modal/buttons/no'));
        $('#modalbox-buttons').css('display', 'flex');
        modalConfirmCb = onYes;
        $('#modalbox').show();
    }

    function hideModal() {
        $('#modalbox').hide();
        $('#modalbox-buttons').hide();
        modalConfirmCb = null;
    }

    // backdrop click closes, button clicks must not bubble up to it
    $('#modalbox').click(e => {
        if (e.target.id === 'modalbox') hideModal();
    });
    $('#modalbox-yes').click(() => {
        const cb = modalConfirmCb;
        hideModal();
        if (cb) cb();
    });
    $('#modalbox-no').click(hideModal);

    ipcRenderer.on('error', (_, error) => {
        ShowModal(error);
    });

    // --------------------------------------------------------------------
    // -------------------- TABS AND DATA UPDATE---------------------------
    // --------------------------------------------------------------------
    function handleTabs() {
        const buttons = document.querySelectorAll('input[name="tabs"]');
        for (const button of buttons) button.addEventListener('click', onTabChange);
    }

    function onTabChange($e) {
        const tab = $e.target.dataset.tab;

        switch ($e.target.dataset.tab) {
            case '2':
                OpenModName = null;
                ipcRenderer.send('get mods');
                break;
            case '3':
                OpenInstallName = null;
                ipcRenderer.send('get installable mods');
                $('#installableModulesView').hide();
                $('#loading').show();
                break;
            case '4':
                ipcRenderer.send('get config');
                break;
        }

        const tabs = document.querySelectorAll('.tab--active');
        for (const tab of tabs) tab.classList.remove('tab--active');
        const contentElement = document.querySelector(`.tab[data-tab="${tab}"]`);
        contentElement.classList.add('tab--active');
    }
    handleTabs();

    // --------------------------------------------------------------------
    // ------------------------------ RUN! --------------------------------
    // --------------------------------------------------------------------
    ipcRenderer.send('init');
});
