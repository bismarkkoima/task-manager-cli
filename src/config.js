'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TaskError } = require('./errors');
const { PRIORITIES, SORT_KEYS } = require('./constants');
const { writeJsonAtomic } = require('./storage');

const SCHEMA = {
  defaultCommand: {
    type: 'enum',
    values: ['list', 'stats', 'projects', 'tags'],
    default: 'list',
    description: 'Command to run when "task" is called with no arguments',
  },
  defaultPriority: {
    type: 'enum',
    values: PRIORITIES,
    default: 'medium',
    description: 'Priority given to new tasks',
  },
  defaultSort: {
    type: 'enum',
    values: SORT_KEYS,
    default: 'urgency',
    description: 'Sort order for "task list"',
  },
  color: { type: 'boolean', default: true, description: 'Use colors in terminal output' },
  historyLimit: {
    type: 'integer',
    min: 0,
    max: 500,
    default: 20,
    description: 'Number of changes "task undo" can revert',
  },
  dataFile: {
    type: 'path',
    default: null,
    description: 'Where tasks are stored (default: ~/.local/share/task-cli/tasks.json)',
  },
};

const TRUE_WORDS = new Set(['true', 'yes', 'on', '1']);
const FALSE_WORDS = new Set(['false', 'no', 'off', '0']);

function homeDir(env) {
  return env.HOME || os.homedir();
}

function defaultConfigFile(env) {
  if (env.TASK_CONFIG) return env.TASK_CONFIG;
  const base = env.XDG_CONFIG_HOME || path.join(homeDir(env), '.config');
  return path.join(base, 'task-cli', 'config.json');
}

function defaultDataFile(env) {
  const base = env.XDG_DATA_HOME || path.join(homeDir(env), '.local', 'share');
  return path.join(base, 'task-cli', 'tasks.json');
}

function expandHome(file, env) {
  return file === '~' || file.startsWith('~/') ? path.join(homeDir(env), file.slice(1)) : file;
}

function assertKey(key) {
  if (!Object.hasOwn(SCHEMA, key)) {
    throw new TaskError(`Unknown config key "${key}". Valid keys: ${Object.keys(SCHEMA).join(', ')}.`);
  }
}

function coerce(key, raw, env) {
  const spec = SCHEMA[key];
  const text = String(raw).trim();
  switch (spec.type) {
    case 'boolean':
      if (TRUE_WORDS.has(text.toLowerCase())) return true;
      if (FALSE_WORDS.has(text.toLowerCase())) return false;
      throw new TaskError(`${key} must be true or false.`);
    case 'integer': {
      const value = Number(text);
      if (!Number.isInteger(value) || value < spec.min || value > spec.max) {
        throw new TaskError(`${key} must be a whole number from ${spec.min} to ${spec.max}.`);
      }
      return value;
    }
    case 'enum':
      if (!spec.values.includes(text)) {
        throw new TaskError(`${key} must be one of: ${spec.values.join(', ')}.`);
      }
      return text;
    case 'path':
      if (!text) throw new TaskError(`${key} cannot be empty. Use "task config unset ${key}" instead.`);
      return path.resolve(expandHome(text, env));
    default:
      throw new Error(`Unhandled config type ${spec.type}`);
  }
}

/** User settings stored as JSON, layered over built-in defaults. */
class Config {
  constructor(env = process.env) {
    this.env = env;
    this.file = defaultConfigFile(env);
    this.stored = this.#read();
  }

  #read() {
    let raw;
    try {
      raw = fs.readFileSync(this.file, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return {};
      throw new TaskError(`Could not read config ${this.file}: ${err.message}`);
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('expected an object');
      return parsed;
    } catch (err) {
      throw new TaskError(`Invalid config file ${this.file}: ${err.message}`);
    }
  }

  get(key) {
    assertKey(key);
    return Object.hasOwn(this.stored, key) ? this.stored[key] : SCHEMA[key].default;
  }

  set(key, raw) {
    assertKey(key);
    const value = coerce(key, raw, this.env);
    this.stored = { ...this.stored, [key]: value };
    writeJsonAtomic(this.file, this.stored);
    return value;
  }

  unset(key) {
    assertKey(key);
    const { [key]: _removed, ...rest } = this.stored;
    this.stored = rest;
    writeJsonAtomic(this.file, this.stored);
  }

  entries() {
    return Object.entries(SCHEMA).map(([key, spec]) => ({
      key,
      value: this.get(key),
      isDefault: !Object.hasOwn(this.stored, key),
      description: spec.description,
    }));
  }

  /** Data file precedence: --file flag, TASKS_FILE env var, config, XDG default. */
  dataFile(override) {
    const file = override || this.env.TASKS_FILE || this.get('dataFile') || defaultDataFile(this.env);
    return path.resolve(expandHome(file, this.env));
  }
}

module.exports = { Config, SCHEMA };
