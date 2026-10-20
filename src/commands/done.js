'use strict';

const { parseIds } = require('../query');
const { describeDate } = require('../dates');
const { taskLine } = require('../format');

module.exports = {
  name: 'done',
  aliases: ['complete', 'do', 'finish'],
  summary: 'Mark tasks as completed',
  usage: 'task done <id...>',
  options: {},
  examples: ['task done 4', 'task done 1 2 5', 'task done 3-6'],
  notes: ['Completing a recurring task schedules its next occurrence.'],

  run(ctx, { positionals }) {
    const result = ctx.service.complete(parseIds(positionals));
    if (ctx.json) return ctx.printJson(result);
    const { colors } = ctx;
    for (const task of result.completed) ctx.out(`${colors.green('✔ Completed')} ${taskLine(task, colors)}`);
    for (const task of result.spawned) {
      ctx.out(
        `${colors.cyan('↻ Next')}      ${taskLine(task, colors)} ${colors.dim(`due ${describeDate(task.due, ctx.today)}`)}`,
      );
    }
    for (const task of result.skipped) ctx.out(colors.dim(`Task ${task.id} is already done.`));
  },
};
