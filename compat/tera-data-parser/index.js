// Deprecated. Kept so third-party mods that require('tera-data-parser') keep working.
require('@anemanator/toolbox-mui').warnDeprecated('deprecated/package', {
    old: 'tera-data-parser',
    new: '@anemanator/data-parser'
});

module.exports = require('@anemanator/data-parser');
