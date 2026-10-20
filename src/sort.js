'use strict';

const { TaskError } = require('./errors');
const { SORT_KEYS } = require('./constants');
const { daysBetween } = require('./dates');

const PRIORITY_WEIGHT = { high: 6, medium: 3, low: 0 };
const PRIORITY_RANK = { high: 2, medium: 1, low: 0 };

/**
 * A score combining priority, due date and age, used for the default sort.
 * Higher means more urgent. Overdue and due-today tasks score highest on the due axis;
 * the due contribution fades linearly to 2 for tasks due two weeks or more out.
 */
function urgency(task, today) {
  if (task.status === 'done') return 0;
  let score = PRIORITY_WEIGHT[task.priority] ?? 0;
  if (task.due) {
    const daysLeft = daysBetween(today, task.due);
    if (daysLeft <= 0) score += 12;
    else if (daysLeft >= 14) score += 2;
    else score += 12 - (daysLeft * 10) / 14;
  }
  if (task.project) score += 1;
  if (task.tags.length) score += 0.5;
  const ageDays = Math.max(0, daysBetween(task.createdAt.slice(0, 10), today));
  score += Math.min(ageDays / 30, 1) * 2;
  return Math.round(score * 10) / 10;
}

const byDue = (a, b) => {
  if (a.due === b.due) return 0;
  if (!a.due) return 1;
  if (!b.due) return -1;
  return a.due < b.due ? -1 : 1;
};

function comparator(key, today) {
  switch (key) {
    case 'urgency':
      return (a, b) => urgency(b, today) - urgency(a, today);
    case 'due':
      return (a, b) => byDue(a, b) || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    case 'priority':
      return (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || byDue(a, b);
    case 'created':
      return (a, b) => a.createdAt.localeCompare(b.createdAt);
    case 'title':
      return (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    case 'id':
      return () => 0;
    default:
      throw new TaskError(`Unknown sort key "${key}". Use one of: ${SORT_KEYS.join(', ')}.`);
  }
}

/** Sort tasks by the given key. Pending tasks always come before completed ones. */
function sortTasks(tasks, key, today, { reverse = false } = {}) {
  const compare = comparator(key, today);
  const sorted = [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    const result = compare(a, b) || a.id - b.id;
    return reverse ? -result : result;
  });
  return sorted;
}

module.exports = { urgency, sortTasks };
