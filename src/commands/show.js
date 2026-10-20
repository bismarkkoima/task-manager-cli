'use strict';

const { parseIds } = require('../query');
const { renderTaskDetail } = require('../format');

module.exports = {
  name: 'show',
  aliases: ['info', 'view'],
  summary: 'Show full details of tasks',
  usage: 'task show <id...>',
  options: {},
  examples: ['task show 3', 'task 3', 'task show 1-3'],

  run(ctx, { positionals }) {
    const tasks = parseIds(positionals).map((id) => ctx.service.get(id));
    if (ctx.json) return ctx.printJson(tasks.length === 1 ? tasks[0] : tasks);
    tasks.forEach((task, index) => {
      if (index > 0) ctx.out('');
      for (const line of renderTaskDetail(task, ctx)) ctx.out(line);
    });
  },
};
