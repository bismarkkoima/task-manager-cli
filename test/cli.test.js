'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createCli, tempDir } = require('./helpers');
const { version } = require('../package.json');

describe('task add / list / show', () => {
  test('adds tasks with inline modifiers and options', () => {
    const cli = createCli();
    const result = cli('add', 'Finish', 'report', '+work', 'project:job', 'due:fri', 'pri:h');
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Added #1 Finish report \(due Fri, in job\)/);

    const [task] = cli.json('list');
    assert.equal(task.title, 'Finish report');
    assert.equal(task.priority, 'high');
    assert.equal(task.due, '2026-10-23');
    assert.deepEqual(task.tags, ['work']);

    cli('add', 'Call mom', '-p', 'l', '-d', 'tomorrow', '-t', 'family', '-n', 'Ask about Sunday');
    const call = cli.json('show', '2');
    assert.equal(call.priority, 'low');
    assert.equal(call.notes[0].text, 'Ask about Sunday');
  });

  test('uses the configured default priority', () => {
    const cli = createCli();
    cli('config', 'set', 'defaultPriority', 'low');
    cli('add', 'x');
    assert.equal(cli.json('show', '1').priority, 'low');
  });

  test('list shows a table with a summary', () => {
    const cli = createCli();
    cli('add', 'Overdue thing', 'due:-1d');
    cli('add', 'Today thing', 'due:today', 'project:home', '+chores');
    const { stdout } = cli('list');
    assert.match(stdout, /ID\s+Pri\s+Due\s+Project\s+Title\s+Tags/);
    assert.match(stdout, /1\s+M\s+yesterday\s+Overdue thing/);
    assert.match(stdout, /2\s+M\s+today\s+home\s+Today thing\s+\+chores/);
    assert.match(stdout, /2 tasks · 1 overdue · 1 due today/);
  });

  test('list hides empty optional columns', () => {
    const cli = createCli();
    cli('add', 'Plain');
    assert.doesNotMatch(cli('ls').stdout, /Project|Tags|Due/);
  });

  test('list filters and limits', () => {
    const cli = createCli();
    cli('add', 'a', 'project:work');
    cli('add', 'b', 'project:home', '+x');
    cli('add', 'c', 'project:work', 'pri:h');
    assert.deepEqual(cli.json('ls', 'project:work').map((t) => t.title), ['c', 'a']);
    assert.deepEqual(cli.json('ls', '+x').map((t) => t.title), ['b']);
    assert.deepEqual(cli.json('ls', '-p', 'h').map((t) => t.title), ['c']);
    assert.equal(cli.json('ls', '--limit', '1').length, 1);
    assert.deepEqual(cli.json('ls', '--sort', 'id', '--reverse').map((t) => t.id), [3, 2, 1]);
    assert.match(cli('ls', '-n', '2').stdout, /showing 2 of 3/);
    assert.match(cli('ls', 'nothing-matches').stdout, /No matching tasks/);
  });

  test('a bare id shows that task', () => {
    const cli = createCli();
    cli('add', 'Something', 'recur:weekly');
    const { stdout } = cli('1');
    assert.match(stdout, /#1 Something/);
    assert.match(stdout, /Repeats\s+weekly/);
  });

  test('running with no command lists tasks', () => {
    const cli = createCli();
    cli('add', 'hello');
    assert.match(cli().stdout, /hello/);
  });
});

describe('changing tasks', () => {
  test('done completes tasks and schedules recurrences', () => {
    const cli = createCli();
    cli('add', 'Plants', 'recur:weekly', 'due:today');
    const { stdout } = cli('done', '1');
    assert.match(stdout, /Completed #1 Plants/);
    assert.match(stdout, /Next\s+#2 Plants due Oct 27/);
    assert.match(cli('done', '1').stdout, /already done/);
  });

  test('edit updates fields and supports clearing', () => {
    const cli = createCli();
    cli('add', 'Old', 'project:home', 'due:fri', '+a');
    cli('edit', '1', 'New', 'title', 'pri:h', '+b');
    let task = cli.json('show', '1');
    assert.equal(task.title, 'New title');
    assert.equal(task.priority, 'high');
    assert.deepEqual(task.tags, ['a', 'b']);

    cli('edit', '1', '--untag', 'a', '--due', 'none', '--project', 'none');
    task = cli.json('show', '1');
    assert.deepEqual(task.tags, ['b']);
    assert.equal(task.due, null);
    assert.equal(task.project, null);
  });

  test('edit refuses to rename several tasks at once', () => {
    const cli = createCli();
    cli('add', 'a');
    cli('add', 'b');
    const result = cli('edit', '1-2', 'Same name');
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Only one task can be renamed/);
  });

  test('reopen, note, delete, clean and undo', () => {
    const cli = createCli();
    cli('add', 'a');
    cli('add', 'b');
    cli('done', '1,2');
    assert.match(cli('reopen', '2').stdout, /Reopened #2 b/);
    assert.match(cli('note', '2', 'some', 'detail').stdout, /Noted on #2 b/);
    assert.match(cli('note', '2').stdout, /some detail/);
    assert.match(cli('clean').stdout, /Removed 1 completed task/);
    assert.equal(cli.json('ls', '--all').length, 1);
    assert.match(cli('undo').stdout, /Undid clean 1 completed task/);
    assert.equal(cli.json('ls', '--all').length, 2);
    assert.match(cli('rm', '2').stdout, /Deleted #2 b/);
    assert.match(cli('undo', '--list').stdout, /1\. .*delete #2/);
  });

  test('search includes completed tasks and matches notes', () => {
    const cli = createCli();
    cli('add', 'Pay invoice');
    cli('add', 'Email Sam', '-n', 'about the invoice');
    cli('add', 'Unrelated');
    cli('done', '1');
    assert.deepEqual(cli.json('search', 'invoice').map((t) => t.id).sort(), [1, 2]);
    assert.deepEqual(cli.json('search', 'invoice', '--pending').map((t) => t.id), [2]);
  });
});

describe('projects, tags and stats', () => {
  test('projects and tags list counts and plain names', () => {
    const cli = createCli();
    cli('add', 'a', 'project:work', '+x');
    cli('add', 'b', 'project:home', '+x', '+y');
    cli('done', '2');
    assert.match(cli('projects').stdout, /home\s+0\s+1\n.*work\s+1\s+0/);
    assert.equal(cli('tags', '--plain').stdout, 'x\ny\n');
    assert.deepEqual(cli.json('tags'), [
      { name: 'x', pending: 1, done: 1 },
      { name: 'y', pending: 0, done: 1 },
    ]);
  });

  test('stats renders an overview', () => {
    const cli = createCli();
    cli('add', 'a', 'project:work');
    cli('add', 'b', 'due:-3d');
    cli('done', '1');
    const { stdout } = cli('stats');
    assert.match(stdout, /Pending\s+1/);
    assert.match(stdout, /Overdue\s+1/);
    assert.match(stdout, /Completion\s+50%/);
    assert.match(stdout, /Streak\s+1 day/);
    assert.match(stdout, /work\s+■{10}\s+1\/1 done/);
  });
});

describe('import and export', () => {
  test('export to a file and import it into a fresh list', () => {
    const cli = createCli();
    cli('add', 'One', 'project:work', '+a', 'due:fri');
    cli('add', 'Two, with comma', '-n', 'note "quoted"');
    cli('done', '2');

    for (const format of ['json', 'csv']) {
      const file = path.join(cli.dir, `out.${format}`);
      const exported = cli('export', '--output', file);
      assert.equal(exported.code, 0);
      assert.match(exported.stderr, /Exported 2 tasks/);
      assert.match(cli('export', '--output', file).stderr, /already exists/);

      const other = createCli();
      assert.match(other('import', file).stdout, /Imported 2 tasks/);
      const tasks = other.json('ls', '--all', '--sort', 'id');
      assert.deepEqual(tasks.map((t) => t.title), ['One', 'Two, with comma']);
      assert.equal(tasks[1].status, 'done');
      assert.equal(tasks[1].notes[0].text, 'note "quoted"');
      assert.deepEqual(tasks[0].tags, ['a']);
    }
  });

  test('export to stdout respects filters and formats', () => {
    const cli = createCli();
    cli('add', 'Work thing', 'project:work');
    cli('add', 'Home thing', 'project:home');
    const md = cli('export', 'project:work', '--format', 'md').stdout;
    assert.match(md, /## work\n\n- \[ \] Work thing/);
    assert.doesNotMatch(md, /Home thing/);
  });

  test('import from stdin, dry run and replace', () => {
    const stdin = JSON.stringify([{ title: 'From stdin' }, { title: 'Another' }]);
    const cli = createCli({ stdin });
    cli('add', 'Existing');
    assert.match(cli('import', '-', '--dry-run').stdout, /2 tasks would be imported/);
    assert.equal(cli.json('ls').length, 1);
    assert.match(cli('import', '-', '--replace').stdout, /Replaced all tasks with 2 tasks/);
    assert.deepEqual(cli.json('ls', '--sort', 'id').map((t) => t.title), ['From stdin', 'Another']);
    cli('undo');
    assert.deepEqual(cli.json('ls').map((t) => t.title), ['Existing']);
  });

  test('import reports bad files', () => {
    const cli = createCli();
    const file = path.join(cli.dir, 'bad.json');
    fs.writeFileSync(file, '[{"title": ""}]');
    const result = cli('import', file);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Task 1 in import: Task title cannot be empty/);
    assert.match(cli('import', path.join(cli.dir, 'missing.json')).stderr, /Could not read/);
  });
});

describe('config', () => {
  test('set, get, list and unset', () => {
    const cli = createCli();
    assert.equal(cli('config', 'set', 'defaultSort', 'due').stdout, 'defaultSort = due\n');
    assert.equal(cli('config', 'get', 'defaultSort').stdout, 'due\n');
    assert.match(cli('config').stdout, /defaultSort\s+due \*/);
    cli('config', 'unset', 'defaultSort');
    assert.equal(cli('config', 'get', 'defaultSort').stdout, 'urgency\n');
  });

  test('validates keys and values', () => {
    const cli = createCli();
    assert.match(cli('config', 'set', 'nope', '1').stderr, /Unknown config key/);
    assert.match(cli('config', 'set', 'historyLimit', '1000').stderr, /whole number/);
    assert.match(cli('config', 'set', 'color', 'maybe').stderr, /true or false/);
  });

  test('dataFile setting moves where tasks are stored', () => {
    const dir = tempDir();
    const cli = createCli({ env: { TASKS_FILE: '' } });
    const file = path.join(dir, 'elsewhere.json');
    cli('config', 'set', 'dataFile', file);
    cli('add', 'stored elsewhere');
    assert.ok(fs.existsSync(file));
  });

  test('--file overrides the data file for one command', () => {
    const cli = createCli();
    const file = path.join(cli.dir, 'other.json');
    cli('--file', file, 'add', 'x');
    assert.equal(cli.json('ls').length, 0);
    assert.equal(cli.json('ls', '--file', file).length, 1);
  });
});

describe('help, errors and misc', () => {
  test('help and version', () => {
    const cli = createCli();
    assert.match(cli('help').stdout, /Usage: task \[command\]/);
    assert.match(cli('--help').stdout, /Commands:/);
    assert.match(cli('help', 'add').stdout, /Usage: task add/);
    assert.match(cli('add', '--help').stdout, /Examples:/);
    assert.equal(cli('--version').stdout, `${version}\n`);
  });

  test('errors exit non-zero with a message on stderr', () => {
    const cli = createCli();
    let result = cli('frobnicate');
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Unknown command "frobnicate"/);

    result = cli('show', '42');
    assert.equal(result.code, 1);
    assert.equal(result.stderr, 'error: Task 42 not found.\n');

    result = cli('ls', '--bogus');
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Unknown option '--bogus'/);

    assert.equal(cli('add').code, 2);
    assert.match(cli('add', 'x', 'due:someday').stderr, /Unrecognized date "someday"/);
  });

  test('corrupt data files are not overwritten', () => {
    const cli = createCli();
    fs.writeFileSync(cli.env.TASKS_FILE, '{oops');
    const result = cli('add', 'x');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /not valid JSON/);
    assert.equal(fs.readFileSync(cli.env.TASKS_FILE, 'utf8'), '{oops');
  });

  test('completion scripts for each shell', () => {
    const cli = createCli();
    assert.match(cli('completion', 'bash').stdout, /complete -F _task_completion task/);
    assert.match(cli('completion', 'zsh').stdout, /#compdef task/);
    assert.match(cli('completion', 'fish').stdout, /complete -c task/);
    assert.equal(cli('completion', 'tcsh').code, 2);
  });

  test('colors only appear when forced or on a TTY', () => {
    const plain = createCli();
    plain('add', 'x', 'pri:h');
    assert.doesNotMatch(plain('ls').stdout, /\x1b\[/);
    const colored = createCli({ env: { FORCE_COLOR: '1' } });
    colored('add', 'x', 'pri:h');
    assert.match(colored('ls').stdout, /\x1b\[31mH/);
    assert.doesNotMatch(colored('ls', '--no-color').stdout, /\x1b\[/);
  });
});

test('the bin script runs as a real process', () => {
  const dir = tempDir();
  const bin = path.join(__dirname, '..', 'bin', 'task.js');
  const env = { ...process.env, TASKS_FILE: path.join(dir, 't.json'), TASK_CONFIG: path.join(dir, 'c.json') };
  const added = spawnSync(process.execPath, [bin, 'add', 'From a subprocess'], { env, encoding: 'utf8' });
  assert.equal(added.status, 0, added.stderr);
  const failed = spawnSync(process.execPath, [bin, 'show', '9'], { env, encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /Task 9 not found/);
});
