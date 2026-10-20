'use strict';

const fs = require('node:fs');
const { parseArgs } = require('node:util');
const { version } = require('../package.json');
const { TaskError, UsageError } = require('./errors');
const { Config } = require('./config');
const { Storage } = require('./storage');
const { TaskService } = require('./tasks');
const { toISODate } = require('./dates');
const { createColors } = require('./format');
const { isIdList } = require('./query');
const { completionScript, SHELLS } = require('./completion');
const { GLOBAL_OPTIONS, generalHelp, commandHelp } = require('./help');
const { commands } = require('./commands');

const show = commands.find((c) => c.name === 'show');

const completion = {
  name: 'completion',
  aliases: [],
  summary: 'Print a shell completion script',
  usage: `task completion <${SHELLS.join('|')}>`,
  options: {},
  examples: ['eval "$(task completion bash)"', 'task completion fish > ~/.config/fish/completions/task.fish'],
  run(ctx, { positionals }) {
    ctx.write(completionScript(positionals[0], commands));
  },
};

const help = {
  name: 'help',
  aliases: [],
  summary: 'Show help for a command',
  usage: 'task help [command]',
  options: {},
  run(ctx, { positionals }) {
    const [name] = positionals;
    if (!name) return printLines(ctx, generalHelp(commands, { version, colors: ctx.colors }));
    const command = findCommand(name);
    if (!command) throw new UsageError(`Unknown command "${name}". Run "task help" for a list.`);
    printLines(ctx, commandHelp(command, ctx));
  },
};

const allCommands = [...commands, completion, help];

function findCommand(name) {
  const lower = name.toLowerCase();
  return allCommands.find((c) => c.name === lower || c.aliases.includes(lower));
}

function printLines(ctx, lines) {
  for (const line of lines) ctx.out(line);
}

/** Find the command word, skipping global flags (and the value after --file). */
function locateCommand(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') return -1;
    if (arg === '--file') {
      i++;
      continue;
    }
    if (!arg.startsWith('-')) return i;
  }
  return -1;
}

function createContext({ io, config, values }) {
  const colorEnabled =
    !values['no-color'] &&
    !io.env.NO_COLOR &&
    config.get('color') &&
    (io.isTTY || Boolean(io.env.FORCE_COLOR));
  let service;

  return {
    config,
    colors: createColors(colorEnabled),
    json: Boolean(values.json),
    columns: io.columns || 100,
    now: io.now,
    get today() {
      return toISODate(io.now());
    },
    get service() {
      service ??= new TaskService(new Storage(config.dataFile(values.file)), {
        now: io.now,
        historyLimit: config.get('historyLimit'),
      });
      return service;
    },
    out: (line = '') => io.stdout(`${line}\n`),
    err: (line = '') => io.stderr(`${line}\n`),
    write: (text) => io.stdout(text),
    printJson: (value) => io.stdout(`${JSON.stringify(value, null, 2)}\n`),
    readStdin: io.readStdin,
  };
}

/** Parse arguments and run one command. Throws on failure. */
function run(argv, io) {
  const index = locateCommand(argv);
  let command;
  let args = argv;

  if (index !== -1) {
    const word = argv[index];
    command = findCommand(word);
    if (command) {
      args = [...argv.slice(0, index), ...argv.slice(index + 1)];
    } else if (isIdList(word)) {
      command = show; // `task 3` is shorthand for `task show 3`
    } else {
      throw new UsageError(`Unknown command "${word}". Run "task help" for a list of commands.`);
    }
  }

  const { values, positionals } = parseArgs({
    args,
    options: { ...GLOBAL_OPTIONS, ...(command?.options ?? {}) },
    allowPositionals: true,
    strict: true,
  });

  const config = new Config(io.env);
  const ctx = createContext({ io, config, values });

  if (values.version) return ctx.out(version);
  if (values.help) {
    return printLines(ctx, command ? commandHelp(command, ctx) : generalHelp(commands, { version, colors: ctx.colors }));
  }
  if (!command) command = findCommand(config.get('defaultCommand'));
  command.run(ctx, { values, positionals });
}

function defaultIO() {
  return {
    env: process.env,
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    isTTY: Boolean(process.stdout.isTTY),
    columns: process.stdout.columns,
    now: () => new Date(),
    readStdin: () => fs.readFileSync(0, 'utf8'),
  };
}

/** Run the CLI and return a process exit code. Never throws. */
function main(argv, io = defaultIO()) {
  try {
    run(argv, io);
    return 0;
  } catch (err) {
    const useColor = io.isTTY && !io.env.NO_COLOR;
    const label = useColor ? '\x1b[31merror:\x1b[0m' : 'error:';
    if (err instanceof TaskError) {
      io.stderr(`${label} ${err.message}\n`);
      return err.exitCode;
    }
    if (typeof err.code === 'string' && err.code.startsWith('ERR_PARSE_ARGS')) {
      io.stderr(`${label} ${err.message}\nRun "task help" for usage.\n`);
      return 2;
    }
    io.stderr(
      io.env.DEBUG ? `${err.stack}\n` : `${label} unexpected failure: ${err.message} (set DEBUG=1 for details)\n`,
    );
    return 1;
  }
}

module.exports = { main, run, findCommand, allCommands };
