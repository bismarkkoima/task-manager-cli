'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { parseModifiers, buildFilter, parseIds, normalizePriority } = require('../src/query');
const { sortTasks, urgency } = require('../src/sort');
const { NOW } = require('./helpers');

function task(overrides) {
  return {
    id: 1,
    title: 'Task',
    status: 'pending',
    priority: 'medium',
    project: null,
    tags: [],
    due: null,
    recurrence: null,
    notes: [],
    createdAt: '2026-10-20T08:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

describe('parseModifiers', () => {
  test('separates modifiers from title words', () => {
    const mods = parseModifiers(['Buy', 'milk', '+Errands', 'project:home', 'due:tomorrow', 'pri:h', 'recur:weekly']);
    assert.deepEqual(mods.text, ['Buy', 'milk']);
    assert.deepEqual(mods.tags, ['errands']);
    assert.equal(mods.project, 'home');
    assert.equal(mods.due, 'tomorrow');
    assert.equal(mods.priority, 'high');
    assert.equal(mods.recurrence, '1w');
  });

  test('quoted words with spaces are always text', () => {
    assert.deepEqual(parseModifiers(['+1 the proposal', 'due: friday']).text, ['+1 the proposal', 'due: friday']);
  });

  test('unknown prefixes stay in the title', () => {
    assert.deepEqual(parseModifiers(['Re:', 'invoice', 'http://x.y']).text, ['Re:', 'invoice', 'http://x.y']);
  });

  test('"none" clears a field', () => {
    const mods = parseModifiers(['project:none', 'recur:none']);
    assert.equal(mods.project, null);
    assert.equal(mods.recurrence, null);
  });

  test('rejects invalid values', () => {
    assert.throws(() => parseModifiers(['pri:urgent']), /Invalid priority/);
    assert.throws(() => parseModifiers(['status:maybe']), /Invalid status/);
    assert.throws(() => parseModifiers(['project:a..b']), /Invalid project/);
  });
});

test('normalizePriority accepts short forms', () => {
  assert.equal(normalizePriority('H'), 'high');
  assert.equal(normalizePriority('med'), 'medium');
  assert.equal(normalizePriority('l'), 'low');
});

describe('buildFilter', () => {
  const tasks = [
    task({ id: 1, title: 'Write report', project: 'work', tags: ['urgent'], due: '2026-10-18' }),
    task({ id: 2, title: 'Fix bug', project: 'work.app', due: '2026-10-20', priority: 'high' }),
    task({ id: 3, title: 'Groceries', tags: ['errands'], due: '2026-10-25' }),
    task({ id: 4, title: 'Read', notes: [{ text: 'chapter on reports' }] }),
    task({ id: 5, title: 'Old report', status: 'done', due: '2026-10-01' }),
  ];
  const ids = (criteria) => tasks.filter(buildFilter(criteria, NOW)).map((t) => t.id);

  test('defaults to pending tasks', () => {
    assert.deepEqual(ids({}), [1, 2, 3, 4]);
    assert.deepEqual(ids({ status: 'done' }), [5]);
    assert.deepEqual(ids({ status: 'all' }), [1, 2, 3, 4, 5]);
  });

  test('projects match hierarchically', () => {
    assert.deepEqual(ids({ project: 'work' }), [1, 2]);
    assert.deepEqual(ids({ project: 'work.app' }), [2]);
    assert.deepEqual(ids({ project: 'wor' }), []);
    assert.deepEqual(ids({ project: null }), [3, 4]);
  });

  test('tags, priority and text', () => {
    assert.deepEqual(ids({ tags: ['urgent'] }), [1]);
    assert.deepEqual(ids({ priority: 'high' }), [2]);
    assert.deepEqual(ids({ text: ['report'], status: 'all' }), [1, 4, 5]);
  });

  test('due keywords', () => {
    assert.deepEqual(ids({ due: 'overdue' }), [1]);
    assert.deepEqual(ids({ due: 'today' }), [1, 2]);
    assert.deepEqual(ids({ due: 'week' }), [1, 2, 3]);
    assert.deepEqual(ids({ due: 'none' }), [4]);
    assert.deepEqual(ids({ due: 'any' }), [1, 2, 3]);
    assert.deepEqual(ids({ due: '2026-10-19' }), [1]);
  });
});

describe('parseIds', () => {
  test('supports lists and ranges', () => {
    assert.deepEqual(parseIds(['3']), [3]);
    assert.deepEqual(parseIds(['1,2', '5-7', '2']), [1, 2, 5, 6, 7]);
  });

  test('rejects bad ids', () => {
    assert.throws(() => parseIds(['abc']), /Invalid task id/);
    assert.throws(() => parseIds(['5-2']), /Invalid id range/);
    assert.throws(() => parseIds(['1-5000']), /too large/);
    assert.throws(() => parseIds([]), /At least one/);
  });
});

describe('sorting', () => {
  const today = '2026-10-20';

  test('urgency favors overdue and high-priority tasks', () => {
    const overdue = task({ due: '2026-10-18' });
    const high = task({ priority: 'high' });
    const later = task({ due: '2026-12-01' });
    assert.ok(urgency(overdue, today) > urgency(high, today));
    assert.ok(urgency(high, today) > urgency(later, today));
    assert.equal(urgency(task({ status: 'done' }), today), 0);
  });

  test('pending tasks always come before completed ones', () => {
    const sorted = sortTasks(
      [task({ id: 1, status: 'done', priority: 'high' }), task({ id: 2, priority: 'low' })],
      'priority',
      today,
    );
    assert.deepEqual(sorted.map((t) => t.id), [2, 1]);
  });

  test('due sort puts undated tasks last', () => {
    const sorted = sortTasks(
      [task({ id: 1 }), task({ id: 2, due: '2026-11-01' }), task({ id: 3, due: '2026-10-21' })],
      'due',
      today,
    );
    assert.deepEqual(sorted.map((t) => t.id), [3, 2, 1]);
  });

  test('rejects unknown sort keys', () => {
    assert.throws(() => sortTasks([], 'color', today), /Unknown sort key/);
  });
});
