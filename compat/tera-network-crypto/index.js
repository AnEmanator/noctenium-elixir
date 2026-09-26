// Deprecated. Kept so third-party mods that require('tera-network-crypto') keep working.
require('@anemanator/toolbox-mui').warnDeprecated('deprecated/package', {
    old: 'tera-network-crypto',
    new: '@anemanator/network-crypto'
});

module.exports = require('@anemanator/network-crypto');
