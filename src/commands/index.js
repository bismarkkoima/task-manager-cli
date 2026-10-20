'use strict';

const commands = [
  require('./add'),
  require('./list'),
  require('./search'),
  require('./show'),
  require('./done'),
  require('./reopen'),
  require('./edit'),
  require('./note'),
  require('./delete'),
  require('./projects'),
  require('./tags'),
  require('./stats'),
  require('./clean'),
  require('./undo'),
  require('./export'),
  require('./import'),
  require('./config'),
];

module.exports = { commands };
