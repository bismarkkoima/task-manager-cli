'use strict';

const { parseIds } = require('../query');
const { taskLine } = require('../format');

module.exports = {
  name: 'delete',
  aliases: ['rm', 'del', 'remove'],
  summary: 'Delete tasks permanently (can be undone with "task undo")',
  usage: 'task delete <id...>',
  options: {},
  examples: ['task rm 7', 'task delete 2,4,9'],

  run(ctx, { positionals }) {
    const removed = ctx.service.remove(parseIds(positionals));
    if (ctx.json) return ctx.printJson(removed);
    for (const task of removed) ctx.out(`${ctx.colors.red('Deleted')} ${taskLine(task, ctx.colors)}`);
  },
};
