'use strict';

const { UsageError } = require('../errors');
const { parseModifiers, normalizePriority, resolveDue, resolveRecurrence } = require('../query');
const { describeDate } = require('../dates');
const { describeRecurrence } = require('../recurrence');
const { taskLine } = require('../format');

module.exports = {
  name: 'add',
  aliases: ['a', 'new'],
  summary: 'Add a new task',
  usage: 'task add <title...> [+tag] [project:<name>] [due:<date>] [pri:<h|m|l>] [recur:<rule>]',
  options: {
    priority: { type: 'string', short: 'p', description: 'Priority: high, medium or low (h/m/l)' },
    project: { type: 'string', short: 'P', description: 'Project name, e.g. work or home.garden' },
    due: { type: 'string', short: 'd', description: 'Due date, e.g. 2026-11-01, tomorrow, fri, +3d' },
    tag: { type: 'string', short: 't', multiple: true, description: 'Add a tag (repeatable)' },
    recur: { type: 'string', short: 'r', description: 'Repeat: daily, weekly, weekdays, "every 2 weeks"' },
    note: { type: 'string', short: 'n', description: 'Attach a note' },
  },
  examples: [
    'task add Buy milk +errands due:tomorrow',
    'task add "Quarterly report" project:work pri:h due:eom',
    'task add Water plants recur:weekly due:sat',
    'task add Call the bank -p high -d fri -t finance',
  ],

  run(ctx, { values, positionals }) {
    const mods = parseModifiers(positionals);
    const title = mods.text.join(' ');
    if (!title.trim()) {
      throw new UsageError('A task title is required. Example: task add Buy milk due:tomorrow');
    }

    const task = ctx.service.add({
      title,
      priority: normalizePriority(values.priority ?? mods.priority ?? ctx.config.get('defaultPriority')),
      project: values.project ?? mods.project ?? null,
      tags: [...mods.tags, ...(values.tag ?? [])],
      due: resolveDue(values.due ?? mods.due, ctx.now()) ?? null,
      recurrence: resolveRecurrence(values.recur ?? mods.recurrence) ?? null,
      note: values.note,
    });

    if (ctx.json) return ctx.printJson(task);
    const { colors } = ctx;
    const details = [];
    if (task.due) details.push(`due ${describeDate(task.due, ctx.today)}`);
    if (task.recurrence) details.push(describeRecurrence(task.recurrence));
    if (task.project) details.push(`in ${task.project}`);
    const suffix = details.length ? colors.dim(` (${details.join(', ')})`) : '';
    ctx.out(`${colors.green('Added')} ${taskLine(task, colors)}${suffix}`);
  },
};
