'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detectFormat, exportTasks, importTasks, parseCSV } = require('../src/exporters');

const tasks = [
  {
    id: 1,
    title: 'Say "hi", then leave',
    status: 'pending',
    priority: 'high',
    project: 'work',
    tags: ['a', 'b'],
    due: '2026-10-23',
    recurrence: '1w',
    notes: [{ text: 'line one', createdAt: '2026-10-20T08:00:00.000Z' }, { text: 'line two', createdAt: '2026-10-20T09:00:00.000Z' }],
    createdAt: '2026-10-20T08:00:00.000Z',
    completedAt: null,
  },
  {
    id: 2,
    title: 'Done thing',
    status: 'done',
    priority: 'medium',
    project: null,
    tags: [],
    due: null,
    recurrence: null,
    notes: [],
    createdAt: '2026-10-19T08:00:00.000Z',
    completedAt: '2026-10-20T08:00:00.000Z',
  },
];

test('detectFormat uses the flag, then the file extension', () => {
  assert.equal(detectFormat(undefined, undefined), 'json');
  assert.equal(detectFormat('CSV', 'x.json'), 'csv');
  assert.equal(detectFormat(undefined, 'out.md'), 'md');
  assert.equal(detectFormat('markdown'), 'md');
  assert.throws(() => detectFormat('xml'), /Unsupported format/);
});

test('JSON round-trips', () => {
  assert.deepEqual(importTasks(exportTasks(tasks, 'json'), 'json'), tasks);
  assert.deepEqual(importTasks(JSON.stringify({ tasks }), 'json'), tasks);
  assert.throws(() => importTasks('{"nope":1}', 'json'), /expects an array/);
});

test('CSV escapes quotes, commas and newlines', () => {
  const csv = exportTasks(tasks, 'csv');
  assert.match(csv, /"Say ""hi"", then leave"/);
  const [row] = importTasks(csv, 'csv');
  assert.equal(row.title, 'Say "hi", then leave');
  assert.equal(row.tags, 'a b');
  assert.deepEqual(row.notes, ['line one', 'line two']);
  assert.equal(row.recurrence, '1w');
});

test('parseCSV handles CRLF, BOM and blank lines', () => {
  assert.deepEqual(parseCSV('﻿a,b\r\n1,2\r\n\r\n"x\r\ny",3'), [
    ['a', 'b'],
    ['1', '2'],
    ['x\r\ny', '3'],
  ]);
  assert.throws(() => parseCSV('"open'), /unterminated/);
});

test('CSV import needs a title column', () => {
  assert.throws(() => importTasks('name\nx', 'csv'), /"title" column/);
});

test('Markdown groups by project as a checklist', () => {
  const md = exportTasks(tasks, 'md');
  assert.match(md, /## work\n\n- \[ \] Say "hi", then leave \(due 2026-10-23, high priority, weekly\) #a #b/);
  assert.match(md, /## No project\n\n- \[x\] Done thing/);
  assert.match(md, / {2}- line one/);
});
