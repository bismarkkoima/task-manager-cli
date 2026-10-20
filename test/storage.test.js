'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Storage, SCHEMA_VERSION } = require('../src/storage');
const { tempDir } = require('./helpers');

test('a missing or empty file loads as an empty task list', () => {
  const dir = tempDir();
  const storage = new Storage(path.join(dir, 'tasks.json'));
  assert.deepEqual(storage.load(), { version: SCHEMA_VERSION, nextId: 1, tasks: [] });
  fs.writeFileSync(storage.file, '  \n');
  assert.deepEqual(storage.load().tasks, []);
});

test('save creates parent directories and round-trips data', () => {
  const dir = tempDir();
  const storage = new Storage(path.join(dir, 'nested', 'deeper', 'tasks.json'));
  const data = { version: SCHEMA_VERSION, nextId: 2, tasks: [{ id: 1, title: 'x' }] };
  storage.save(data);
  assert.deepEqual(storage.load(), data);
  assert.deepEqual(
    fs.readdirSync(path.dirname(storage.file)),
    ['tasks.json'],
    'no temp files are left behind',
  );
});

test('corrupt JSON is reported, not overwritten', () => {
  const dir = tempDir();
  const storage = new Storage(path.join(dir, 'tasks.json'));
  fs.writeFileSync(storage.file, '{ not json');
  assert.throws(() => storage.load(), /not valid JSON/);
  assert.equal(fs.readFileSync(storage.file, 'utf8'), '{ not json');
});

test('files from a newer schema are refused', () => {
  const dir = tempDir();
  const storage = new Storage(path.join(dir, 'tasks.json'));
  fs.writeFileSync(storage.file, JSON.stringify({ version: 99, nextId: 1, tasks: [] }));
  assert.throws(() => storage.load(), /newer version/);
});

test('a missing nextId is rebuilt from existing ids', () => {
  const dir = tempDir();
  const storage = new Storage(path.join(dir, 'tasks.json'));
  fs.writeFileSync(storage.file, JSON.stringify({ tasks: [{ id: 4 }, { id: 9 }] }));
  assert.equal(storage.load().nextId, 10);
});

test('a damaged history file is treated as empty', () => {
  const dir = tempDir();
  const storage = new Storage(path.join(dir, 'tasks.json'));
  fs.writeFileSync(storage.historyFile, 'garbage');
  assert.deepEqual(storage.loadHistory(), []);
});
