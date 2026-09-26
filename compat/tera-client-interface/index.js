// Deprecated. Kept so third-party mods that require('tera-client-interface') keep working.
require('@anemanator/toolbox-mui').warnDeprecated('deprecated/package', {
    old: 'tera-client-interface',
    new: '@anemanator/client-interface'
});

module.exports = require('@anemanator/client-interface');
