'use strict';

const { UsageError } = require('../errors');
const { parseModifiers } = require('../query');
const { listTasks, criteriaFrom, parseLimit, filterOptions } = require('./list');

module.exports = {
  name: 'search',
  aliases: ['find', 'grep'],
  summary: 'Search titles and notes of all tasks, including completed ones',
  usage: 'task search <text...> [filters...]',
  options: {
    pending: { type: 'boolean', description: 'Only pending tasks' },
    ...filterOptions,
  },
  examples: ['task search invoice', 'task search dentist project:health'],

  run(ctx, { values, positionals }) {
    const mods = parseModifiers(positionals);
    if (!mods.text.length) throw new UsageError('Give some text to search for, e.g. task search invoice');
    const criteria = criteriaFrom(values, mods, values.pending ? 'pending' : 'all');
    listTasks(ctx, criteria, {
      sort: values.sort ?? ctx.config.get('defaultSort'),
      reverse: values.reverse,
      limit: parseLimit(values.limit),
    });
  },
};
