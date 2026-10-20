'use strict';

const { UsageError } = require('../errors');
const { parseIds } = require('../query');
const { formatTimestamp } = require('../dates');
const { taskLine } = require('../format');

module.exports = {
  name: 'note',
  aliases: ['annotate', 'n'],
  summary: 'Add a note to a task, or list its notes',
  usage: 'task note <id> [text...]',
  options: {},
  examples: ['task note 3 Left a voicemail, call back Friday', 'task note 3'],

  run(ctx, { positionals }) {
    const [idArg, ...words] = positionals;
    if (!idArg) throw new UsageError('Which task? Example: task note 3 Waiting on reply');
    const [id] = parseIds([idArg]);
    const { colors } = ctx;

    if (!words.length) {
      const task = ctx.service.get(id);
      if (ctx.json) return ctx.printJson(task.notes);
      if (!task.notes.length) return ctx.out(colors.dim(`Task ${id} has no notes.`));
      ctx.out(taskLine(task, colors));
      for (const note of task.notes) ctx.out(`  ${colors.dim(formatTimestamp(note.createdAt))}  ${note.text}`);
      return;
    }

    const task = ctx.service.addNote(id, words.join(' '));
    if (ctx.json) return ctx.printJson(task);
    ctx.out(`${colors.green('Noted')} on ${taskLine(task, colors)}`);
  },
};
