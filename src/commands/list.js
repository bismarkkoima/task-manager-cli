'use strict';

const { TaskError } = require('../errors');
const { parseModifiers, normalizePriority, buildFilter } = require('../query');
const { sortTasks } = require('../sort');
const { renderTaskTable, summarizeTasks } = require('../format');

/** Shared by `list` and `search`. */
function listTasks(ctx, criteria, { sort, reverse, limit }) {
  const filter = buildFilter(criteria, ctx.now());
  let tasks = sortTasks(ctx.service.all().filter(filter), sort, ctx.today, { reverse });
  const matched = tasks.length;
  if (limit !== undefined) tasks = tasks.slice(0, limit);

  if (ctx.json) return ctx.printJson(tasks);
  if (!tasks.length) {
    ctx.out(ctx.colors.dim('No matching tasks.'));
    return;
  }
  for (const line of renderTaskTable(tasks, ctx)) ctx.out(line);
  const shown = matched > tasks.length ? ` (showing ${tasks.length} of ${matched})` : '';
  ctx.out('');
  ctx.out(ctx.colors.dim(summarizeTasks(tasks, ctx.today) + shown));
}

function parseLimit(value) {
  if (value === undefined) return undefined;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) throw new TaskError('--limit must be a positive whole number.');
  return limit;
}

const filterOptions = {
  project: { type: 'string', short: 'P', description: 'Only tasks in this project (and sub-projects)' },
  tag: { type: 'string', short: 't', multiple: true, description: 'Only tasks with this tag (repeatable)' },
  priority: { type: 'string', short: 'p', description: 'Only tasks with this priority' },
  due: { type: 'string', short: 'd', description: 'today, week, overdue, none, any, or a date (due on or before)' },
  sort: { type: 'string', short: 's', description: 'urgency, due, priority, created, id or title' },
  reverse: { type: 'boolean', description: 'Reverse the sort order' },
  limit: { type: 'string', short: 'n', description: 'Show at most this many tasks' },
};

function criteriaFrom(values, mods, defaultStatus) {
  return {
    status: values.all ? 'all' : values.done ? 'done' : (mods.status ?? defaultStatus),
    project: values.project ?? mods.project,
    tags: [...mods.tags, ...(values.tag ?? []).map((t) => t.replace(/^\+/, '').toLowerCase())],
    priority:
      values.priority !== undefined
        ? normalizePriority(values.priority)
        : mods.priority,
    due: values.overdue ? 'overdue' : (values.due ?? mods.due),
    text: mods.text,
  };
}

module.exports = {
  name: 'list',
  aliases: ['ls', 'l'],
  summary: 'List tasks (pending by default)',
  usage: 'task list [filters...] [options]',
  options: {
    all: { type: 'boolean', short: 'a', description: 'Include completed tasks' },
    done: { type: 'boolean', description: 'Only completed tasks' },
    overdue: { type: 'boolean', short: 'o', description: 'Only overdue tasks' },
    ...filterOptions,
  },
  examples: [
    'task list',
    'task ls +errands',
    'task ls project:work due:week',
    'task ls --all --sort due',
    'task ls pri:h --limit 5',
  ],
  notes: [
    'Filters can be combined: +tag, project:<name>, pri:<h|m|l>, due:<when>, status:<pending|done|all>.',
    'Any other words must appear in the task title or notes.',
  ],

  run(ctx, { values, positionals }) {
    const mods = parseModifiers(positionals);
    listTasks(ctx, criteriaFrom(values, mods, 'pending'), {
      sort: values.sort ?? ctx.config.get('defaultSort'),
      reverse: values.reverse,
      limit: parseLimit(values.limit),
    });
  },

  listTasks,
  criteriaFrom,
  parseLimit,
  filterOptions,
};
