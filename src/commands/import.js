'use strict';

const fs = require('node:fs');
const { TaskError, UsageError } = require('../errors');
const { detectFormat, importTasks } = require('../exporters');

module.exports = {
  name: 'import',
  aliases: [],
  summary: 'Import tasks from a JSON or CSV file',
  usage: 'task import <file|-> [--format json|csv] [--replace] [--dry-run]',
  options: {
    format: { type: 'string', short: 'f', description: 'json or csv (default: from the file extension)' },
    replace: { type: 'boolean', description: 'Replace all existing tasks instead of adding to them' },
    'dry-run': { type: 'boolean', description: 'Validate the file without saving anything' },
  },
  examples: ['task import backup.json', 'task import todo.csv --dry-run', 'cat tasks.json | task import -'],
  notes: ['Imported tasks get new ids. Use "task undo" to revert an import.'],

  run(ctx, { values, positionals }) {
    const [file] = positionals;
    if (!file) throw new UsageError('Give a file to import, or "-" to read from stdin.');
    const format = detectFormat(values.format ?? (file === '-' ? 'json' : undefined), file === '-' ? undefined : file);

    let text;
    try {
      text = file === '-' ? ctx.readStdin() : fs.readFileSync(file, 'utf8');
    } catch (err) {
      throw new TaskError(`Could not read ${file}: ${err.message}`);
    }
    const raw = importTasks(text, format);
    if (!raw.length) throw new TaskError('No tasks found to import.');

    if (values['dry-run']) {
      ctx.service.validateImport(raw);
      return ctx.out(`${raw.length} task${raw.length === 1 ? '' : 's'} would be imported.`);
    }
    const imported = ctx.service.import(raw, { replace: values.replace });
    if (ctx.json) return ctx.printJson(imported);
    const verb = values.replace ? 'Replaced all tasks with' : 'Imported';
    ctx.out(`${ctx.colors.green(verb)} ${imported.length} task${imported.length === 1 ? '' : 's'}.`);
  },
};
