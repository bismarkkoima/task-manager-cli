'use strict';

const { renderTable } = require('../format');

/** Builds the `projects` and `tags` commands, which share a layout. */
function countCommand({ name, aliases, summary, noun, collect, prefix }) {
  return {
    name,
    aliases,
    summary,
    usage: `task ${name} [--plain]`,
    options: {
      plain: { type: 'boolean', description: `Print bare ${noun} names (for scripts and completion)` },
    },
    examples: [`task ${name}`],

    run(ctx, { values }) {
      const entries = collect(ctx.service);
      if (ctx.json) return ctx.printJson(entries);
      if (values.plain) {
        for (const entry of entries) ctx.out(entry.name);
        return;
      }
      if (!entries.length) return ctx.out(ctx.colors.dim(`No ${noun}s yet.`));
      const { colors } = ctx;
      const columns = [
        { key: 'name', header: noun[0].toUpperCase() + noun.slice(1), flex: true },
        { key: 'pending', header: 'Pending', align: 'right' },
        { key: 'done', header: 'Done', align: 'right' },
      ];
      const rows = entries.map((entry) => ({
        name: { text: prefix + entry.name, style: colors.magenta },
        pending: { text: String(entry.pending) },
        done: { text: String(entry.done), style: colors.dim },
      }));
      for (const line of renderTable(columns, rows, { colors, maxWidth: ctx.columns })) ctx.out(line);
    },
  };
}

module.exports = countCommand({
  name: 'projects',
  aliases: ['project'],
  summary: 'List projects with task counts',
  noun: 'project',
  prefix: '',
  collect: (service) => service.projects(),
});
module.exports.countCommand = countCommand;
