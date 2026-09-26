// display keywords for mods. the allowed set is exactly the keys of mod-keywords.json.
// resolution order:
//   1. valid keywords declared in module.json (array, or comma-separated string;
//      matched case-insensitively, anything unknown is dropped)
//   2. guessed from the mod description
//   3. guessed from the mod title
//   4. ["Unknown"]
const KeywordMap = require('./mod-keywords.json');
const Allowed = Object.keys(KeywordMap);

// lowercased key -> canonical key, so "library" resolves to "Library"
const Canonical = {};
Allowed.forEach(k => {
    Canonical[k.toLowerCase()] = k;
});

function normalize(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return raw.split(',');
    return [];
}

function guessFrom(text) {
    const t = String(text || '').toLowerCase();
    if (!t) return [];
    return Allowed.filter(cat => KeywordMap[cat].some(word => t.includes(word.toLowerCase())));
}

function modTitle(modInfo) {
    if (modInfo.options && (modInfo.options.guiName || modInfo.options.cliName))
        return modInfo.options.guiName || modInfo.options.cliName;
    return modInfo.rawName || modInfo.name || '';
}

function resolveKeywords(modInfo) {
    // rawKeywords is what the author declared (loadModuleInfo force-adds "network" to keywords)
    const raw = modInfo.rawKeywords !== undefined ? modInfo.rawKeywords : modInfo.keywords;
    const declared = normalize(raw)
        .map(k => Canonical[String(k).trim().toLowerCase()])
        .filter(Boolean);
    if (declared.length > 0) return [...new Set(declared)];

    const fromDesc = guessFrom(modInfo.description);
    if (fromDesc.length > 0) return fromDesc;

    const fromTitle = guessFrom(modTitle(modInfo));
    if (fromTitle.length > 0) return fromTitle;

    return ['Unknown'];
}

module.exports = { resolveKeywords, AllowedKeywords: Allowed };
