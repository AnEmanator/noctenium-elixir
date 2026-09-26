const path = require('path');
const fs = require('fs');

const LanguageFolder = path.join(__dirname, 'language');
const DefaultLanguage = 'en';

// Load valid languages
let LanguageNames = {};
fs.readdirSync(LanguageFolder).filter(filename => filename.endsWith('.js')).map(filename => filename.replace('.js', '')).forEach(language => {
    LanguageNames[language] = require(path.join(LanguageFolder, `${language}.js`)).Name;
});

// MUI implementation
class ToolboxMUI {
    constructor(language) {
        this.language = language;
        if (!this.language || !LanguageNames[this.language])
            this.language = DefaultLanguage;

        this.implementation = require(path.join(LanguageFolder, `${this.language}.js`)).GetString;
    }

    get(str, tokens) {
        return this.implementation(str, tokens);
    }
}

// Default instance
let DefaultInstance = null;
function InitializeDefaultInstance(language) {
    DefaultInstance = new ToolboxMUI(language);
    return DefaultInstance;
}

InitializeDefaultInstance(DefaultLanguage);

// Deprecation warnings. Localised, deduped, yellow in the GUI, Developer Mode only
// (the audience is mod authors, not users). `key` is a `deprecated/*` string; tokens
// flow through, plus `mod` - passed explicitly or sniffed from the call stack.
const seenDeprecations = new Set();

function callerModName() {
    // the default 10-frame limit is too shallow once the node module loader is on the stack
    const saved = Error.stackTraceLimit;
    Error.stackTraceLimit = 30;
    const stack = new Error().stack || '';
    Error.stackTraceLimit = saved;

    const m = stack.match(/[/\\]mods[/\\]([^/\\\n]+)/);
    return m ? m[1].replace(/\.js$/i, '') : null;
}

function warnDeprecated(key, tokens = {}) {
    const tb = global.Toolbox;
    if (!tb || !tb.DevMode) return;

    const mod = tokens.mod || callerModName();
    const dedupe = `${key}|${tokens.old || ''}|${mod || ''}`;
    if (seenDeprecations.has(dedupe)) return;
    seenDeprecations.add(dedupe);

    const line = DefaultInstance.get(key, { ...tokens, mod: mod || '' });
    // the GUI paints stderr lines starting with "warn:" yellow and strips the prefix
    console.warn(tb.GUIMode ? `warn:${line}` : line);
}

// Exports
module.exports = {
    DefaultLanguage, InitializeDefaultInstance, LanguageNames, ToolboxMUI, warnDeprecated,
    DefaultInstance: {
        get: function (...args) { return DefaultInstance.get(...args); },
        get language() { return DefaultInstance.language; }
    }
};
