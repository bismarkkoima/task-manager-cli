'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Modules are required lazily so lower-level tests do not load the whole CLI.

// Tuesday 20 October 2026, mid-morning local time.
const NOW = new Date(2026, 9, 20, 10, 30);

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'task-cli-test-'));
}

/** A clock that can be moved forward during a test. */
function createClock(start = NOW) {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    advanceDays(days) {
      current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + days, 10, 30);
    },
  };
}

function createService(options = {}) {
  const { Storage } = require('../src/storage');
  const { TaskService } = require('../src/tasks');
  const dir = tempDir();
  const clock = options.clock ?? createClock();
  const storage = new Storage(path.join(dir, 'tasks.json'));
  const service = new TaskService(storage, { now: clock.now, historyLimit: options.historyLimit ?? 20 });
  return { service, storage, clock, dir };
}

/**
 * Run the CLI in-process against an isolated data directory.
 * Returns a `cli(...args)` function that yields { code, stdout, stderr }.
 */
function createCli({ clock = createClock(), env = {}, stdin = '' } = {}) {
  const { main } = require('../src/cli');
  const dir = tempDir();
  const baseEnv = {
    HOME: dir,
    TASKS_FILE: path.join(dir, 'tasks.json'),
    TASK_CONFIG: path.join(dir, 'config.json'),
    ...env,
  };

  function cli(...argv) {
    let stdout = '';
    let stderr = '';
    const code = main(argv, {
      env: baseEnv,
      stdout: (text) => (stdout += text),
      stderr: (text) => (stderr += text),
      isTTY: false,
      columns: 120,
      now: clock.now,
      readStdin: () => stdin,
    });
    return { code, stdout, stderr };
  }

  cli.dir = dir;
  cli.clock = clock;
  cli.env = baseEnv;
  cli.json = (...argv) => {
    const result = cli(...argv, '--json');
    if (result.code !== 0) throw new Error(`task ${argv.join(' ')} failed: ${result.stderr}`);
    return JSON.parse(result.stdout);
  };
  return cli;
}

module.exports = { NOW, tempDir, createClock, createService, createCli };
