'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { TaskError } = require('../errors');
const { parseModifiers, buildFilter } = require('../query');
const { sortTasks } = require('../sort');
const { detectFormat, exportTasks } = require('../exporters');
const { criteriaFrom } = require('./list');

module.exports = {
  name: 'export',
  aliases: [],
  summary: 'Export tasks as JSON, CSV or Markdown',
  usage: 'task export [filters...] [--format json|csv|md] [--output <file>]',
  options: {
    format: { type: 'string', short: 'f', description: 'json (default), csv or md' },
    output: { type: 'string', short: 'o', description: 'Write to a file instead of stdout' },
    pending: { type: 'boolean', description: 'Only pending tasks (default: all tasks)' },
    force: { type: 'boolean', description: 'Overwrite the output file if it exists' },
  },
  examples: [
    'task export > backup.json',
    'task export --output tasks.csv',
    'task export project:work --pending --format md',
  ],

  run(ctx, { values, positionals }) {
    const format = detectFormat(values.format, values.output);
    const mods = parseModifiers(positionals);
    const criteria = criteriaFrom({}, mods, values.pending ? 'pending' : 'all');
    const tasks = sortTasks(ctx.service.all().filter(buildFilter(criteria, ctx.now())), 'id', ctx.today);
    const content = exportTasks(tasks, format);

    if (!values.output) {
      ctx.write(content);
      return;
    }
    const file = path.resolve(values.output);
    if (fs.existsSync(file) && !values.force) {
      throw new TaskError(`${values.output} already exists. Use --force to overwrite it.`);
    }
    fs.writeFileSync(file, content);
    ctx.err(`Exported ${tasks.length} task${tasks.length === 1 ? '' : 's'} to ${values.output}`);
  },
};
