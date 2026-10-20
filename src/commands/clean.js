'use strict';

module.exports = {
  name: 'clean',
  aliases: ['clear', 'purge'],
  summary: 'Delete all completed tasks',
  usage: 'task clean',
  options: {},
  examples: ['task clean'],

  run(ctx) {
    const removed = ctx.service.clean();
    if (ctx.json) return ctx.printJson(removed);
    if (!removed.length) return ctx.out(ctx.colors.dim('No completed tasks to remove.'));
    ctx.out(
      `Removed ${removed.length} completed task${removed.length === 1 ? '' : 's'}. ${ctx.colors.dim('Run "task undo" to bring them back.')}`,
    );
  },
};
