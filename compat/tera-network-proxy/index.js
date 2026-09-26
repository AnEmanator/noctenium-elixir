// Deprecated. Kept so third-party mods that require('tera-network-proxy') keep working.
require('@anemanator/toolbox-mui').warnDeprecated('deprecated/package', {
    old: 'tera-network-proxy',
    new: '@anemanator/network-proxy'
});

module.exports = require('@anemanator/network-proxy');
