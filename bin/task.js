#!/usr/bin/env node
'use strict';

const { main } = require('../src/cli');

// Exit quietly when piped into a command that closes early, e.g. `task ls | head`.
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

process.exitCode = main(process.argv.slice(2));
