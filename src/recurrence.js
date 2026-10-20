'use strict';

const { TaskError } = require('./errors');
const { addDays, addInterval, fromISODate, toISODate } = require('./dates');

// Rules are stored compactly: "<n><unit>" (e.g. "1d", "2w", "3m") or "weekdays".
const NAMED_RULES = {
  daily: '1d',
  weekly: '1w',
  biweekly: '2w',
  fortnightly: '2w',
  monthly: '1m',
  quarterly: '3m',
  yearly: '1y',
  annually: '1y',
  weekdays: 'weekdays',
};

const UNIT_NAMES = { d: 'day', w: 'week', m: 'month', y: 'year' };
const SINGLE_NAMES = { d: 'daily', w: 'weekly', m: 'monthly', y: 'yearly' };
const RULE_PATTERN = /^(\d+)([dwmy])$/;

/** Parse "daily", "weekly", "every 2 weeks", "3d", "weekdays", ... into a stored rule. */
function parseRecurrence(input) {
  const text = String(input).trim().toLowerCase();
  if (NAMED_RULES[text]) return NAMED_RULES[text];

  const match =
    /^(?:every\s+)?(\d+)?\s*(d|days?|w|weeks?|m|months?|y|years?)$/.exec(text);
  if (match) {
    const amount = match[1] === undefined ? 1 : Number(match[1]);
    if (amount < 1 || amount > 999) {
      throw new TaskError(`Recurrence interval must be between 1 and 999, got ${amount}.`);
    }
    return `${amount}${match[2][0]}`;
  }

  throw new TaskError(
    `Unrecognized recurrence "${input}". Try daily, weekly, monthly, yearly, weekdays or "every 2 weeks".`,
  );
}

function isValidRule(rule) {
  return rule === 'weekdays' || RULE_PATTERN.test(rule);
}

function describeRecurrence(rule) {
  if (rule === 'weekdays') return 'every weekday';
  const [, amount, unit] = RULE_PATTERN.exec(rule);
  if (amount === '1') return SINGLE_NAMES[unit];
  return `every ${amount} ${UNIT_NAMES[unit]}s`;
}

/** The first date after `fromIso` on which the rule fires again. */
function nextOccurrence(rule, fromIso) {
  const from = fromISODate(fromIso);
  if (rule === 'weekdays') {
    let next = addDays(from, 1);
    while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1);
    return toISODate(next);
  }
  const [, amount, unit] = RULE_PATTERN.exec(rule);
  return toISODate(addInterval(from, Number(amount), unit));
}

module.exports = { parseRecurrence, isValidRule, describeRecurrence, nextOccurrence };
