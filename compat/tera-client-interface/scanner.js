// Deprecated subpath shim. See ./index.js.
require('@anemanator/toolbox-mui').warnDeprecated('deprecated/subpath', {
    old: 'tera-client-interface/scanner',
    new: '@anemanator/client-interface/scanner'
});

module.exports = require('@anemanator/client-interface/scanner');
