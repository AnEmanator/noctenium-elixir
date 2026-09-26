// Deprecated. Kept so third-party mods that require('tera-mod-ui') keep working.
require('@anemanator/toolbox-mui').warnDeprecated('deprecated/package', {
    old: 'tera-mod-ui',
    new: '@anemanator/mod-ui'
});

module.exports = require('@anemanator/mod-ui');
