'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseRecurrence, describeRecurrence, nextOccurrence } = require('../src/recurrence');

test('parseRecurrence normalizes many spellings', () => {
  assert.equal(parseRecurrence('daily'), '1d');
  assert.equal(parseRecurrence('Weekly'), '1w');
  assert.equal(parseRecurrence('biweekly'), '2w');
  assert.equal(parseRecurrence('every 3 days'), '3d');
  assert.equal(parseRecurrence('every month'), '1m');
  assert.equal(parseRecurrence('2w'), '2w');
  assert.equal(parseRecurrence('weekdays'), 'weekdays');
});

test('parseRecurrence rejects invalid rules', () => {
  assert.throws(() => parseRecurrence('sometimes'), /Unrecognized recurrence/);
  assert.throws(() => parseRecurrence('0d'), /between 1 and 999/);
});

test('describeRecurrence reads naturally', () => {
  assert.equal(describeRecurrence('1d'), 'daily');
  assert.equal(describeRecurrence('2w'), 'every 2 weeks');
  assert.equal(describeRecurrence('weekdays'), 'every weekday');
});

test('nextOccurrence advances by the interval', () => {
  assert.equal(nextOccurrence('1d', '2026-10-20'), '2026-10-21');
  assert.equal(nextOccurrence('2w', '2026-10-20'), '2026-11-03');
  assert.equal(nextOccurrence('1m', '2026-01-31'), '2026-02-28');
  assert.equal(nextOccurrence('1y', '2028-02-29'), '2029-02-28');
});

test('weekday recurrence skips weekends', () => {
  assert.equal(nextOccurrence('weekdays', '2026-10-23'), '2026-10-26'); // Fri -> Mon
  assert.equal(nextOccurrence('weekdays', '2026-10-20'), '2026-10-21'); // Tue -> Wed
});
