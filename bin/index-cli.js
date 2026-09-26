'use strict';

// keep the CLI window open if something throws during boot
process.stdin.resume();
process.on('uncaughtException', e => {
    console.log(e);
});

// Boot
require('./loader-cli');
