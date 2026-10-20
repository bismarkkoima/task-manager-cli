'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { TaskError } = require('./errors');

const SCHEMA_VERSION = 1;

function emptyData() {
  return { version: SCHEMA_VERSION, nextId: 1, tasks: [] };
}

/** Write JSON via a temp file and rename, so a crash never leaves a half-written file. */
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function checkData(data, file) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) {
    throw new TaskError(`${file} does not look like a task file.`);
  }
  const version = data.version ?? SCHEMA_VERSION;
  if (version > SCHEMA_VERSION) {
    throw new TaskError(
      `${file} was written by a newer version of task-manager-cli (schema v${version}). Please upgrade.`,
    );
  }
  data.version = SCHEMA_VERSION;
  if (!Number.isInteger(data.nextId) || data.nextId < 1) {
    data.nextId = data.tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
  }
  return data;
}

/**
 * Persists tasks as a JSON document, plus a sidecar file holding snapshots
 * of previous states so changes can be undone.
 */
class Storage {
  constructor(file) {
    this.file = file;
    this.historyFile = `${file}.history.json`;
  }

  load() {
    let raw;
    try {
      raw = fs.readFileSync(this.file, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return emptyData();
      throw new TaskError(`Could not read ${this.file}: ${err.message}`);
    }
    if (!raw.trim()) return emptyData();

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      throw new TaskError(
        `${this.file} is not valid JSON (${err.message}). Fix or move the file and try again.`,
      );
    }
    return checkData(data, this.file);
  }

  save(data) {
    writeJsonAtomic(this.file, data);
  }

  loadHistory() {
    try {
      const history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      return Array.isArray(history) ? history : [];
    } catch {
      // A missing or damaged history file only costs the ability to undo.
      return [];
    }
  }

  saveHistory(entries) {
    writeJsonAtomic(this.historyFile, entries);
  }
}

module.exports = { Storage, SCHEMA_VERSION, writeJsonAtomic };
