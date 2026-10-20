'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { parseDate, daysBetween, describeDate, addMonths, fromISODate, toISODate } = require('../src/dates');
const { NOW } = require('./helpers');

// NOW is Tuesday 2026-10-20.
const parse = (input) => parseDate(input, NOW);

describe('parseDate', () => {
  test('accepts ISO dates', () => {
    assert.equal(parse('2026-12-24'), '2026-12-24');
    assert.equal(parse(' 2027-01-01 '), '2027-01-01');
  });

  test('rejects impossible dates', () => {
    assert.throws(() => parse('2026-02-30'), /Unrecognized date/);
    assert.throws(() => parse('2026-13-01'), /Unrecognized date/);
  });

  test('understands named days', () => {
    assert.equal(parse('today'), '2026-10-20');
    assert.equal(parse('Tomorrow'), '2026-10-21');
    assert.equal(parse('yesterday'), '2026-10-19');
  });

  test('weekday names mean the next occurrence after today', () => {
    assert.equal(parse('fri'), '2026-10-23');
    assert.equal(parse('friday'), '2026-10-23');
    assert.equal(parse('next monday'), '2026-10-26');
    // Today is Tuesday, so "tuesday" means a week from now.
    assert.equal(parse('tue'), '2026-10-27');
  });

  test('understands relative offsets', () => {
    assert.equal(parse('+3d'), '2026-10-23');
    assert.equal(parse('3d'), '2026-10-23');
    assert.equal(parse('-2d'), '2026-10-18');
    assert.equal(parse('2w'), '2026-11-03');
    assert.equal(parse('+1m'), '2026-11-20');
    assert.equal(parse('1y'), '2027-10-20');
    assert.equal(parse('in 5 days'), '2026-10-25');
    assert.equal(parse('in 2 weeks'), '2026-11-03');
  });

  test('understands period boundaries', () => {
    assert.equal(parse('eow'), '2026-10-25');
    assert.equal(parse('eom'), '2026-10-31');
    assert.equal(parse('eoy'), '2026-12-31');
    assert.equal(parse('nextweek'), '2026-10-26');
    assert.equal(parse('next month'), '2026-11-01');
  });

  test('rejects nonsense with a helpful message', () => {
    assert.throws(() => parse('someday'), /Try YYYY-MM-DD/);
    assert.throws(() => parse('tu'), /Unrecognized/);
  });
});

describe('date helpers', () => {
  test('addMonths clamps to the end of shorter months', () => {
    assert.equal(toISODate(addMonths(fromISODate('2026-01-31'), 1)), '2026-02-28');
    assert.equal(toISODate(addMonths(fromISODate('2028-01-31'), 1)), '2028-02-29');
  });

  test('daysBetween counts calendar days across DST changes', () => {
    assert.equal(daysBetween('2026-10-20', '2026-11-03'), 14);
    assert.equal(daysBetween('2026-03-01', '2026-04-01'), 31);
    assert.equal(daysBetween('2026-10-20', '2026-10-18'), -2);
  });

  test('describeDate is short and relative', () => {
    const today = '2026-10-20';
    assert.equal(describeDate('2026-10-20', today), 'today');
    assert.equal(describeDate('2026-10-21', today), 'tomorrow');
    assert.equal(describeDate('2026-10-19', today), 'yesterday');
    assert.equal(describeDate('2026-10-23', today), 'Fri');
    assert.equal(describeDate('2026-10-15', today), '5d ago');
    assert.equal(describeDate('2026-11-15', today), 'Nov 15');
    assert.equal(describeDate('2027-02-01', today), 'Feb 1 2027');
  });
});
