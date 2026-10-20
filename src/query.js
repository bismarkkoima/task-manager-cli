'use strict';

const { TaskError } = require('./errors');
const { PRIORITY_ALIASES } = require('./constants');
const { parseDate, addDays, toISODate, fromISODate } = require('./dates');
const { parseRecurrence } = require('./recurrence');
const { validateTag, validateProject } = require('./tasks');

const MODIFIER_KEYS = {
  project: 'project',
  proj: 'project',
  pro: 'project',
  due: 'due',
  priority: 'priority',
  pri: 'priority',
  recur: 'recurrence',
  recurrence: 'recurrence',
  status: 'status',
};

const STATUS_FILTERS = ['pending', 'done', 'all'];
const CLEAR_WORDS = new Set(['', 'none']);

function normalizePriority(value) {
  const priority = PRIORITY_ALIASES[String(value).toLowerCase()];
  if (!priority) throw new TaskError(`Invalid priority "${value}". Use high, medium or low (h/m/l).`);
  return priority;
}

/**
 * Split command-line words into inline modifiers and plain text.
 *
 *   +tag  project:name  due:<date>  pri:h|m|l  recur:<rule>  status:pending|done|all
 *
 * Words containing whitespace (i.e. quoted on the shell) are always plain text,
 * so `task add "+1 the proposal"` keeps its title intact.
 *
 * Returned fields are undefined when not given and null when explicitly cleared
 * (e.g. `project:none`).
 */
function parseModifiers(words) {
  const result = { text: [], tags: [] };
  for (const word of words) {
    if (/\s/.test(word)) {
      result.text.push(word);
      continue;
    }
    if (/^\+[^+]/.test(word)) {
      result.tags.push(validateTag(word.slice(1)));
      continue;
    }
    const match = /^([a-z]+):(.*)$/i.exec(word);
    const key = match && MODIFIER_KEYS[match[1].toLowerCase()];
    if (!key) {
      result.text.push(word);
      continue;
    }
    const value = match[2];
    switch (key) {
      case 'project':
        result.project = CLEAR_WORDS.has(value.toLowerCase()) ? null : validateProject(value);
        break;
      case 'priority':
        result.priority = normalizePriority(value);
        break;
      case 'recurrence':
        result.recurrence = CLEAR_WORDS.has(value.toLowerCase()) ? null : parseRecurrence(value);
        break;
      case 'status':
        if (!STATUS_FILTERS.includes(value.toLowerCase())) {
          throw new TaskError(`Invalid status "${value}". Use pending, done or all.`);
        }
        result.status = value.toLowerCase();
        break;
      default:
        // Due values are interpreted by the caller: a date when adding, a range when filtering.
        result.due = value;
    }
  }
  return result;
}

/** Turn a due value into a stored date: undefined = unchanged, null = cleared. */
function resolveDue(value, now) {
  if (value === undefined) return undefined;
  if (value === null || CLEAR_WORDS.has(String(value).toLowerCase())) return null;
  return parseDate(value, now);
}

function resolveRecurrence(value) {
  if (value === undefined) return undefined;
  if (value === null || CLEAR_WORDS.has(String(value).toLowerCase())) return null;
  return parseRecurrence(value);
}

/** Build a predicate for the `due:` filter. */
function dueFilter(value, now) {
  const today = toISODate(now);
  switch (String(value).toLowerCase()) {
    case 'overdue':
      return (t) => t.status === 'pending' && t.due !== null && t.due < today;
    case 'none':
      return (t) => t.due === null;
    case 'any':
      return (t) => t.due !== null;
    case 'week': {
      const end = toISODate(addDays(fromISODate(today), 7));
      return (t) => t.due !== null && t.due <= end;
    }
    default: {
      // Any other date means "due on or before that date", so due:today includes overdue tasks.
      const limit = parseDate(value, now);
      return (t) => t.due !== null && t.due <= limit;
    }
  }
}

/**
 * Build a task predicate from filter criteria.
 * Projects match hierarchically: project "work" also matches "work.reports".
 */
function buildFilter({ status = 'pending', project, tags = [], priority, due, text = [] }, now) {
  const predicates = [];
  if (status !== 'all') predicates.push((t) => t.status === status);
  if (project === null) predicates.push((t) => t.project === null);
  else if (project !== undefined) {
    const lower = project.toLowerCase();
    predicates.push((t) => {
      const p = t.project?.toLowerCase();
      return p === lower || Boolean(p?.startsWith(`${lower}.`));
    });
  }
  for (const tag of tags) predicates.push((t) => t.tags.includes(tag));
  if (priority !== undefined) predicates.push((t) => t.priority === priority);
  if (due !== undefined) predicates.push(dueFilter(due, now));
  for (const word of text) {
    const needle = word.toLowerCase();
    predicates.push(
      (t) =>
        t.title.toLowerCase().includes(needle) ||
        t.notes.some((note) => note.text.toLowerCase().includes(needle)),
    );
  }
  return (task) => predicates.every((predicate) => predicate(task));
}

/** Parse ids like "3", "1,2", "4-6" or "1 3-5" into a sorted, de-duplicated list. */
function parseIds(args) {
  const ids = new Set();
  for (const part of args.flatMap((arg) => String(arg).split(',')).filter(Boolean)) {
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) {
      const [start, end] = [Number(range[1]), Number(range[2])];
      if (start > end) throw new TaskError(`Invalid id range "${part}".`);
      if (end - start > 1000) throw new TaskError(`Id range "${part}" is too large.`);
      for (let id = start; id <= end; id++) ids.add(id);
    } else if (/^\d+$/.test(part)) {
      ids.add(Number(part));
    } else {
      throw new TaskError(`Invalid task id "${part}".`);
    }
  }
  if (!ids.size) throw new TaskError('At least one task id is required.');
  return [...ids].sort((a, b) => a - b);
}

function isIdList(word) {
  return /^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(word);
}

module.exports = {
  parseModifiers,
  normalizePriority,
  resolveDue,
  resolveRecurrence,
  buildFilter,
  parseIds,
  isIdList,
};
