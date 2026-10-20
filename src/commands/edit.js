'use strict';

const { UsageError } = require('../errors');
const {
  parseIds,
  parseModifiers,
  normalizePriority,
  resolveDue,
  resolveRecurrence,
} = require('../query');
const { taskLine } = require('../format');

module.exports = {
  name: 'edit',
  aliases: ['modify', 'mod', 'e'],
  summary: 'Change a task’s title, priority, project, tags, due date or recurrence',
  usage: 'task edit <id...> [new title...] [+tag] [project:<name>] [due:<date>] [pri:<h|m|l>] [recur:<rule>]',
  options: {
    title: { type: 'string', description: 'New title' },
    priority: { type: 'string', short: 'p', description: 'New priority' },
    project: { type: 'string', short: 'P', description: 'New project ("none" to clear)' },
    due: { type: 'string', short: 'd', description: 'New due date ("none" to clear)' },
    tag: { type: 'string', short: 't', multiple: true, description: 'Add a tag (repeatable)' },
    untag: { type: 'string', short: 'u', multiple: true, description: 'Remove a tag (repeatable)' },
    recur: { type: 'string', short: 'r', description: 'New recurrence ("none" to stop repeating)' },
  },
  examples: [
    'task edit 3 due:fri pri:h',
    'task edit 3 Call the bank about the card',
    'task edit 2-4 project:home +weekend',
    'task edit 5 --untag urgent --due none',
  ],

  run(ctx, { values, positionals }) {
    const [idArg, ...rest] = positionals;
    if (!idArg) throw new UsageError('Which task? Example: task edit 3 due:tomorrow');
    const ids = parseIds([idArg]);
    const mods = parseModifiers(rest);

    const title = values.title ?? (mods.text.length ? mods.text.join(' ') : undefined);
    if (title !== undefined && ids.length > 1) {
      throw new UsageError('Only one task can be renamed at a time.');
    }
    const priority = values.priority ?? mods.priority;
    const changes = {
      title,
      priority: priority === undefined ? undefined : normalizePriority(priority),
      project: values.project !== undefined ? (values.project === 'none' ? null : values.project) : mods.project,
      due: resolveDue(values.due ?? mods.due, ctx.now()),
      recurrence: resolveRecurrence(values.recur ?? mods.recurrence),
      addTags: [...mods.tags, ...(values.tag ?? [])],
      removeTags: values.untag ?? [],
    };

    const tasks = ctx.service.update(ids, changes);
    if (ctx.json) return ctx.printJson(tasks);
    for (const task of tasks) ctx.out(`${ctx.colors.yellow('Updated')} ${taskLine(task, ctx.colors)}`);
  },
};
