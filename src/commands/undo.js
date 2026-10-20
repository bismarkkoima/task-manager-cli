'use strict';

const { formatTimestamp } = require('../dates');

module.exports = {
  name: 'undo',
  aliases: [],
  summary: 'Revert the most recent change',
  usage: 'task undo [--list]',
  options: {
    list: { type: 'boolean', short: 'l', description: 'Show the changes that can be undone' },
  },
  examples: ['task undo', 'task undo --list'],

  run(ctx, { values }) {
    const { colors } = ctx;
    if (values.list) {
      const history = ctx.service.history();
      if (ctx.json) return ctx.printJson(history);
      if (!history.length) return ctx.out(colors.dim('Nothing to undo.'));
      history.forEach((entry, index) => {
        ctx.out(`${colors.dim(`${index + 1}.`)} ${colors.dim(formatTimestamp(entry.timestamp))}  ${entry.description}`);
      });
      return;
    }
    const entry = ctx.service.undo();
    if (ctx.json) return ctx.printJson({ undone: entry.description, timestamp: entry.timestamp });
    ctx.out(`${colors.yellow('Undid')} ${entry.description}`);
  },
};
