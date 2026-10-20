'use strict';

const { TaskError } = require('./errors');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const UNIT_ALIASES = {
  d: 'd',
  day: 'd',
  days: 'd',
  w: 'w',
  wk: 'w',
  week: 'w',
  weeks: 'w',
  m: 'm',
  mo: 'm',
  month: 'm',
  months: 'm',
  y: 'y',
  yr: 'y',
  year: 'y',
  years: 'y',
};

const pad2 = (n) => String(n).padStart(2, '0');

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Format a Date as a local YYYY-MM-DD string. */
function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Parse a YYYY-MM-DD string into a local Date, or null if it is not a real date. */
function fromISODate(iso) {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Add months, clamping to the end of the month (Jan 31 + 1 month = Feb 28/29). */
function addMonths(date, months) {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
}

function addInterval(date, amount, unit) {
  switch (unit) {
    case 'd':
      return addDays(date, amount);
    case 'w':
      return addDays(date, amount * 7);
    case 'm':
      return addMonths(date, amount);
    case 'y':
      return addMonths(date, amount * 12);
    default:
      throw new Error(`Unknown interval unit: ${unit}`);
  }
}

function matchDayName(word) {
  if (word.length < 3) return -1;
  return DAY_NAMES.findIndex((name) => name.startsWith(word));
}

function resolveRelative(text, today) {
  switch (text) {
    case 'today':
    case 'tod':
    case 'now':
      return today;
    case 'tomorrow':
    case 'tom':
    case 'tmr':
      return addDays(today, 1);
    case 'yesterday':
      return addDays(today, -1);
    case 'eow':
    case 'endofweek':
      // The upcoming Sunday (today, if today is Sunday).
      return addDays(today, (7 - today.getDay()) % 7);
    case 'eom':
    case 'endofmonth':
      return new Date(today.getFullYear(), today.getMonth() + 1, 0);
    case 'eoy':
    case 'endofyear':
      return new Date(today.getFullYear(), 11, 31);
    case 'nextweek':
    case 'next week':
      // The next Monday strictly after today.
      return addDays(today, (8 - today.getDay()) % 7 || 7);
    case 'nextmonth':
    case 'next month':
      return new Date(today.getFullYear(), today.getMonth() + 1, 1);
    default:
      break;
  }

  let match = /^([+-]?)(\d+)\s*([a-z]+)$/.exec(text);
  if (match && UNIT_ALIASES[match[3]]) {
    const amount = Number(match[2]) * (match[1] === '-' ? -1 : 1);
    return addInterval(today, amount, UNIT_ALIASES[match[3]]);
  }

  match = /^in\s+(\d+)\s+([a-z]+)$/.exec(text);
  if (match && UNIT_ALIASES[match[2]]) {
    return addInterval(today, Number(match[1]), UNIT_ALIASES[match[2]]);
  }

  match = /^(?:next\s+)?([a-z]+)$/.exec(text);
  if (match) {
    const day = matchDayName(match[1]);
    // A weekday name always means the next one strictly after today.
    if (day !== -1) return addDays(today, (day - today.getDay() + 7) % 7 || 7);
  }

  return null;
}

/**
 * Parse a user-supplied date into YYYY-MM-DD.
 *
 * Accepts ISO dates plus relative forms such as "today", "tomorrow", "fri",
 * "next monday", "+3d", "2w", "in 5 days", "eow", "eom" and "nextweek".
 */
function parseDate(input, now = new Date()) {
  const text = String(input).trim().toLowerCase();
  const exact = fromISODate(text);
  if (exact) return toISODate(exact);

  const resolved = resolveRelative(text, startOfDay(now));
  if (!resolved) {
    throw new TaskError(
      `Unrecognized date "${input}". Try YYYY-MM-DD, today, tomorrow, friday, +3d, eow or eom.`,
    );
  }
  return toISODate(resolved);
}

/** Whole days from one YYYY-MM-DD date to another (negative if `to` is earlier). */
function daysBetween(fromIso, toIso) {
  const a = fromISODate(fromIso);
  const b = fromISODate(toIso);
  const utc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(b) - utc(a)) / MS_PER_DAY);
}

/** A short human description of a date relative to today, e.g. "tomorrow" or "Fri". */
function describeDate(iso, todayIso) {
  const diff = daysBetween(todayIso, iso);
  const date = fromISODate(iso);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 1 && diff < 7) {
    const name = DAY_NAMES[date.getDay()];
    return name[0].toUpperCase() + name.slice(1, 3);
  }
  if (diff < 0 && diff > -14) return `${-diff}d ago`;
  const sameYear = iso.slice(0, 4) === todayIso.slice(0, 4);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}${sameYear ? '' : ` ${date.getFullYear()}`}`;
}

/** Format an ISO timestamp as local "YYYY-MM-DD HH:MM". */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return `${toISODate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function weekdayName(iso) {
  return DAY_NAMES[fromISODate(iso).getDay()];
}

module.exports = {
  parseDate,
  toISODate,
  fromISODate,
  addDays,
  addMonths,
  addInterval,
  daysBetween,
  describeDate,
  formatTimestamp,
  weekdayName,
};
