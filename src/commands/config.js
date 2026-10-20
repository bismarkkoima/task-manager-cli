'use strict';

const { UsageError } = require('../errors');

module.exports = {
  name: 'config',
  aliases: ['settings'],
  summary: 'View or change settings',
  usage: 'task config [list | get <key> | set <key> <value> | unset <key> | path]',
  options: {},
  examples: [
    'task config',
    'task config set defaultSort due',
    'task config set dataFile ~/Dropbox/tasks.json',
    'task config unset defaultSort',
  ],

  run(ctx, { positionals }) {
    const [action = 'list', key, ...rest] = positionals;
    const { config, colors } = ctx;

    switch (action) {
      case 'list': {
        const entries = config.entries();
        if (ctx.json) return ctx.printJson(Object.fromEntries(entries.map((e) => [e.key, e.value])));
        const width = Math.max(...entries.map((e) => e.key.length));
        for (const entry of entries) {
          const value = entry.value === null ? colors.dim('(not set)') : String(entry.value);
          const marker = entry.isDefault ? '' : colors.yellow(' *');
          ctx.out(`${entry.key.padEnd(width)}  ${value}${marker}`);
          ctx.out(colors.dim(`${' '.repeat(width)}  ${entry.description}`));
        }
        ctx.out('');
        ctx.out(colors.dim(`* changed from default · ${config.file}`));
        return;
      }
      case 'get':
        if (!key) throw new UsageError('Usage: task config get <key>');
        if (ctx.json) return ctx.printJson(config.get(key));
        return ctx.out(String(config.get(key) ?? ''));
      case 'set': {
        if (!key || !rest.length) throw new UsageError('Usage: task config set <key> <value>');
        const value = config.set(key, rest.join(' '));
        return ctx.out(`${key} = ${value}`);
      }
      case 'unset':
        if (!key) throw new UsageError('Usage: task config unset <key>');
        config.unset(key);
        return ctx.out(`${key} reset to default (${config.get(key) ?? 'not set'})`);
      case 'path':
        return ctx.out(config.file);
      default:
        throw new UsageError(`Unknown config action "${action}". Use list, get, set, unset or path.`);
    }
  },
};
