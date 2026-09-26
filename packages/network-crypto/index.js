const fs = require('fs');

const file = `${__dirname}/bin/network_crypto_${process.versions.modules}.node`;
if (!fs.existsSync(file))
    throw Error(`network-crypto: No build found (platform=${process.versions.electron ? 'electron' : 'node'}, arch=${process.arch}, modulesVer=${process.versions.modules})`);

module.exports = require(file);
