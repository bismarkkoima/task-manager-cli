'use strict';

const { countCommand } = require('./projects');

module.exports = countCommand({
  name: 'tags',
  aliases: ['tag'],
  summary: 'List tags with task counts',
  noun: 'tag',
  prefix: '+',
  collect: (service) => service.tags(),
});
