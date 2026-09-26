// Deprecated. Kept so third-party mods that require('tera-mod-management') keep working.
require('@anemanator/toolbox-mui').warnDeprecated('deprecated/package', {
    old: 'tera-mod-management',
    new: '@anemanator/mod-management'
});

module.exports = require('@anemanator/mod-management');
