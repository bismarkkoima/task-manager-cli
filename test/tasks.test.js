'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { Storage } = require('../src/storage');
const { TaskService } = require('../src/tasks');
const { createService } = require('./helpers');

describe('adding tasks', () => {
  test('stores normalized fields and persists them', () => {
    const { service, storage, clock } = createService();
    const task = service.add({
      title: '  Write   report ',
      priority: 'high',
      project: 'work.reports',
      tags: ['Urgent', '+urgent', 'q4'],
      due: '2026-10-23',
    });
    assert.equal(task.id, 1);
    assert.equal(task.title, 'Write report');
    assert.deepEqual(task.tags, ['urgent', 'q4']);
    assert.equal(task.status, 'pending');

    const reloaded = new TaskService(storage, { now: clock.now });
    assert.deepEqual(reloaded.get(1), task);
  });

  test('validates input', () => {
    const { service } = createService();
    assert.throws(() => service.add({ title: '   ' }), /cannot be empty/);
    assert.throws(() => service.add({ title: 'x', priority: 'urgent' }), /Invalid priority/);
    assert.throws(() => service.add({ title: 'x', project: 'bad name' }), /Invalid project/);
    assert.throws(() => service.add({ title: 'x', tags: ['no spaces'] }), /Invalid tag/);
    assert.throws(() => service.add({ title: 'x', due: '2026-02-30' }), /Invalid due date/);
    assert.throws(() => service.add({ title: 'x'.repeat(501) }), /too long/);
    assert.equal(service.all().length, 0);
  });

  test('recurring tasks default their due date to today', () => {
    const { service } = createService();
    assert.equal(service.add({ title: 'Stand-up', recurrence: '1d' }).due, '2026-10-20');
  });

  test('ids are never reused', () => {
    const { service } = createService();
    service.add({ title: 'a' });
    service.remove([1]);
    assert.equal(service.add({ title: 'b' }).id, 2);
    assert.throws(() => service.get(1), /not found/);
  });
});

describe('editing tasks', () => {
  test('changes only the given fields', () => {
    const { service } = createService();
    service.add({ title: 'a', tags: ['x', 'y'], project: 'home', due: '2026-11-01' });
    const [task] = service.update([1], { priority: 'low', addTags: ['z'], removeTags: ['x'] });
    assert.equal(task.priority, 'low');
    assert.deepEqual(task.tags, ['y', 'z']);
    assert.equal(task.project, 'home');
    assert.equal(task.due, '2026-11-01');
  });

  test('null clears optional fields', () => {
    const { service } = createService();
    service.add({ title: 'a', project: 'home', due: '2026-11-01' });
    const [task] = service.update([1], { project: null, due: null });
    assert.equal(task.project, null);
    assert.equal(task.due, null);
  });

  test('can edit several tasks at once', () => {
    const { service } = createService();
    service.add({ title: 'a' });
    service.add({ title: 'b' });
    service.update([1, 2], { project: 'errands' });
    assert.deepEqual(service.all().map((t) => t.project), ['errands', 'errands']);
  });

  test('refuses an empty change', () => {
    const { service } = createService();
    service.add({ title: 'a' });
    assert.throws(() => service.update([1], {}), /Nothing to change/);
  });
});

describe('completing tasks', () => {
  test('marks tasks done and reports already-completed ones', () => {
    const { service } = createService();
    service.add({ title: 'a' });
    service.add({ title: 'b' });
    service.complete([1]);
    const result = service.complete([1, 2]);
    assert.deepEqual(result.completed.map((t) => t.id), [2]);
    assert.deepEqual(result.skipped.map((t) => t.id), [1]);
    assert.ok(service.get(2).completedAt);
  });

  test('recurring tasks spawn the next occurrence', () => {
    const { service } = createService();
    service.add({ title: 'Water plants', recurrence: '1w', due: '2026-10-24', tags: ['home'] });
    const { spawned } = service.complete([1]);
    assert.equal(spawned.length, 1);
    assert.equal(spawned[0].due, '2026-10-31');
    assert.equal(spawned[0].status, 'pending');
    assert.deepEqual(spawned[0].tags, ['home']);
  });

  test('overdue recurring tasks skip occurrences already in the past', () => {
    const { service } = createService();
    service.add({ title: 'Daily review', recurrence: '1d', due: '2026-10-10' });
    const { spawned } = service.complete([1]);
    assert.equal(spawned[0].due, '2026-10-20');
  });

  test('reopen reverses completion', () => {
    const { service } = createService();
    service.add({ title: 'a' });
    service.complete([1]);
    const { reopened } = service.reopen([1]);
    assert.equal(reopened[0].status, 'pending');
    assert.equal(reopened[0].completedAt, null);
  });

  test('clean removes only completed tasks', () => {
    const { service } = createService();
    service.add({ title: 'a' });
    service.add({ title: 'b' });
    service.complete([1]);
    assert.equal(service.clean().length, 1);
    assert.deepEqual(service.all().map((t) => t.title), ['b']);
    assert.deepEqual(service.clean(), []);
  });
});

describe('notes', () => {
  test('are appended with timestamps', () => {
    const { service } = createService();
    service.add({ title: 'a', note: 'first' });
    service.addNote(1, 'second');
    assert.deepEqual(service.get(1).notes.map((n) => n.text), ['first', 'second']);
    assert.throws(() => service.addNote(1, '  '), /cannot be empty/);
  });
});

describe('undo', () => {
  test('restores the previous state, one step at a time', () => {
    const { service } = createService();
    service.add({ title: 'a' });
    service.add({ title: 'b' });
    service.complete([1]);

    assert.equal(service.undo().description, 'complete #1');
    assert.equal(service.get(1).status, 'pending');
    service.undo();
    assert.equal(service.all().length, 1);
  });

  test('undo restores deleted tasks and id counter', () => {
    const { service } = createService();
    service.add({ title: 'a' });
    service.remove([1]);
    service.undo();
    assert.equal(service.get(1).title, 'a');
    assert.equal(service.add({ title: 'b' }).id, 2);
  });

  test('history is capped and survives restarts', () => {
    const { service, storage, clock } = createService({ historyLimit: 3 });
    for (const title of ['a', 'b', 'c', 'd', 'e']) service.add({ title });
    const reloaded = new TaskService(storage, { now: clock.now, historyLimit: 3 });
    assert.equal(reloaded.history().length, 3);
    assert.equal(reloaded.history()[0].description, 'add "e"');
  });

  test('throws when there is nothing to undo', () => {
    const { service } = createService();
    assert.throws(() => service.undo(), /Nothing to undo/);
  });

  test('a history limit of zero disables undo', () => {
    const { service } = createService({ historyLimit: 0 });
    service.add({ title: 'a' });
    assert.throws(() => service.undo(), /Nothing to undo/);
  });
});

describe('import', () => {
  test('assigns new ids and fills defaults', () => {
    const { service } = createService();
    service.add({ title: 'existing' });
    const imported = service.import([
      { id: 99, title: 'one', tags: 'a b' },
      { title: 'two', status: 'done', notes: ['hello'] },
    ]);
    assert.deepEqual(imported.map((t) => t.id), [2, 3]);
    assert.deepEqual(imported[0].tags, ['a', 'b']);
    assert.equal(imported[0].priority, 'medium');
    assert.ok(imported[1].completedAt);
    assert.equal(imported[1].notes[0].text, 'hello');
  });

  test('replace starts from an empty list', () => {
    const { service } = createService();
    service.add({ title: 'old' });
    service.import([{ title: 'new' }], { replace: true });
    assert.deepEqual(service.all().map((t) => [t.id, t.title]), [[1, 'new']]);
  });

  test('reports which task is invalid and imports nothing', () => {
    const { service } = createService();
    assert.throws(() => service.import([{ title: 'ok' }, { title: '' }]), /Task 2 in import/);
    assert.equal(service.all().length, 0);
  });
});

describe('stats', () => {
  test('summarizes progress', () => {
    const { service, clock } = createService();
    service.add({ title: 'overdue', due: '2026-10-18', priority: 'high' });
    service.add({ title: 'today', due: '2026-10-20', project: 'work' });
    service.add({ title: 'later', due: '2026-12-01', project: 'work' });
    service.add({ title: 'done yesterday' });
    clock.advanceDays(-1);
    service.complete([4]);
    clock.advanceDays(1);
    service.add({ title: 'done today', project: 'work' });
    service.complete([5]);

    const stats = service.stats();
    assert.equal(stats.total, 5);
    assert.equal(stats.pending, 3);
    assert.equal(stats.done, 2);
    assert.equal(stats.overdue, 1);
    assert.equal(stats.dueToday, 1);
    assert.equal(stats.dueThisWeek, 1);
    assert.equal(stats.streak, 2);
    assert.deepEqual(stats.recent.slice(-2).map((d) => d.count), [1, 1]);
    assert.deepEqual(stats.byPriority, { low: 0, medium: 2, high: 1 });
    assert.deepEqual(stats.byProject, [{ name: 'work', pending: 2, done: 1 }]);
  });

  test('a streak survives until the end of today', () => {
    const { service, clock } = createService();
    service.add({ title: 'a' });
    clock.advanceDays(-1);
    service.complete([1]);
    clock.advanceDays(1);
    assert.equal(service.stats().streak, 1);
    clock.advanceDays(1);
    assert.equal(service.stats().streak, 0);
  });
});

test('a fresh service sees changes saved by another instance', () => {
  const { service, storage, clock } = createService();
  service.add({ title: 'a' });
  const other = new TaskService(new Storage(storage.file), { now: clock.now });
  assert.equal(other.all().length, 1);
});
