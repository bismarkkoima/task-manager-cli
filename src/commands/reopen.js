'use strict';

const { parseIds } = require('../query');
const { taskLine } = require('../format');

module.exports = {
  name: 'reopen',
  aliases: ['undone', 'restore'],
  summary: 'Mark completed tasks as pending again',
  usage: 'task reopen <id...>',
  options: {},
  examples: ['task reopen 4'],

  run(ctx, { positionals }) {
    const result = ctx.service.reopen(parseIds(positionals));
    if (ctx.json) return ctx.printJson(result);
    const { colors } = ctx;
    for (const task of result.reopened) ctx.out(`${colors.yellow('Reopened')} ${taskLine(task, colors)}`);
    for (const task of result.skipped) ctx.out(colors.dim(`Task ${task.id} is not completed.`));
  },
};
