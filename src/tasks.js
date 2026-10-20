'use strict';

const { TaskError } = require('./errors');
const { PRIORITIES, STATUSES, PROJECT_PATTERN, TAG_PATTERN } = require('./constants');
const { fromISODate, toISODate, addDays, daysBetween } = require('./dates');
const { isValidRule, nextOccurrence } = require('./recurrence');

const MAX_TITLE_LENGTH = 500;

function validateTitle(title) {
  if (typeof title !== 'string' || !title.trim()) throw new TaskError('Task title cannot be empty.');
  const trimmed = title.trim().replace(/\s+/g, ' ');
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw new TaskError(`Task title is too long (max ${MAX_TITLE_LENGTH} characters).`);
  }
  return trimmed;
}

function validatePriority(priority) {
  if (!PRIORITIES.includes(priority)) {
    throw new TaskError(`Invalid priority "${priority}". Use one of: ${PRIORITIES.join(', ')}.`);
  }
  return priority;
}

function validateProject(project) {
  if (project === null || project === undefined || project === '') return null;
  if (!PROJECT_PATTERN.test(project)) {
    throw new TaskError(
      `Invalid project "${project}". Use letters, numbers, "-" and "_", with "." for sub-projects.`,
    );
  }
  return project;
}

function validateTag(tag) {
  const normalized = String(tag).replace(/^\+/, '').toLowerCase();
  if (!TAG_PATTERN.test(normalized)) {
    throw new TaskError(`Invalid tag "${tag}". Use letters, numbers, "-" and "_".`);
  }
  return normalized;
}

function validateTags(tags) {
  return [...new Set((tags ?? []).map(validateTag))];
}

function validateDue(due) {
  if (due === null || due === undefined || due === '') return null;
  if (!fromISODate(due)) throw new TaskError(`Invalid due date "${due}". Expected YYYY-MM-DD.`);
  return due;
}

function validateRecurrence(rule) {
  if (rule === null || rule === undefined || rule === '') return null;
  if (!isValidRule(rule)) throw new TaskError(`Invalid recurrence rule "${rule}".`);
  return rule;
}

function validateStatus(status) {
  if (!STATUSES.includes(status)) {
    throw new TaskError(`Invalid status "${status}". Use one of: ${STATUSES.join(', ')}.`);
  }
  return status;
}

function validateTimestamp(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (Number.isNaN(Date.parse(value))) throw new TaskError(`Invalid timestamp "${value}".`);
  return new Date(value).toISOString();
}

function validateNotes(notes, fallbackTime) {
  if (notes === null || notes === undefined) return [];
  if (!Array.isArray(notes)) throw new TaskError('Notes must be a list.');
  return notes
    .map((note) => (typeof note === 'string' ? { text: note } : note))
    .filter((note) => note && typeof note.text === 'string' && note.text.trim())
    .map((note) => ({
      text: note.text.trim(),
      createdAt: validateTimestamp(note.createdAt, fallbackTime),
    }));
}

const formatIds = (ids) => ids.map((id) => `#${id}`).join(', ');

/** All task business logic: creation, edits, completion, recurrence, undo and stats. */
class TaskService {
  constructor(storage, { now = () => new Date(), historyLimit = 20 } = {}) {
    this.storage = storage;
    this.now = now;
    this.historyLimit = historyLimit;
    this.data = storage.load();
  }

  get today() {
    return toISODate(this.now());
  }

  all() {
    return this.data.tasks;
  }

  get(id) {
    const task = this.data.tasks.find((t) => t.id === id);
    if (!task) throw new TaskError(`Task ${id} not found.`);
    return task;
  }

  add({ title, priority = 'medium', project = null, tags = [], due = null, recurrence = null, note }) {
    const timestamp = this.now().toISOString();
    const recurrenceRule = validateRecurrence(recurrence);
    const fields = {
      title: validateTitle(title),
      status: 'pending',
      priority: validatePriority(priority),
      project: validateProject(project),
      tags: validateTags(tags),
      // A recurring task needs an anchor date; default to today.
      due: validateDue(due) ?? (recurrenceRule ? this.today : null),
      recurrence: recurrenceRule,
      notes: note ? [{ text: note.trim(), createdAt: timestamp }] : [],
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };

    return this.#mutate(`add "${fields.title}"`, () => {
      const task = { id: this.data.nextId++, ...fields };
      this.data.tasks.push(task);
      return task;
    });
  }

  /**
   * Apply changes to one or more tasks. Undefined fields are left alone;
   * `null` clears optional fields (project, due, recurrence).
   */
  update(ids, changes) {
    const tasks = ids.map((id) => this.get(id));
    const { addTags = [], removeTags = [] } = changes;
    const set = {};
    if (changes.title !== undefined) set.title = validateTitle(changes.title);
    if (changes.priority !== undefined) set.priority = validatePriority(changes.priority);
    if (changes.project !== undefined) set.project = validateProject(changes.project);
    if (changes.due !== undefined) set.due = validateDue(changes.due);
    if (changes.recurrence !== undefined) set.recurrence = validateRecurrence(changes.recurrence);
    if (changes.tags !== undefined) set.tags = validateTags(changes.tags);
    const toAdd = validateTags(addTags);
    const toRemove = validateTags(removeTags);

    if (!Object.keys(set).length && !toAdd.length && !toRemove.length) {
      throw new TaskError('Nothing to change.');
    }

    return this.#mutate(`edit ${formatIds(ids)}`, () => {
      const timestamp = this.now().toISOString();
      for (const task of tasks) {
        Object.assign(task, set);
        if (toAdd.length || toRemove.length) {
          const kept = task.tags.filter((tag) => !toRemove.includes(tag));
          task.tags = [...new Set([...kept, ...toAdd])];
        }
        if (task.recurrence && !task.due) task.due = this.today;
        task.updatedAt = timestamp;
      }
      return tasks;
    });
  }

  /** Mark tasks done. Recurring tasks spawn their next occurrence. */
  complete(ids) {
    const tasks = ids.map((id) => this.get(id));
    const pending = tasks.filter((task) => task.status !== 'done');
    const skipped = tasks.filter((task) => task.status === 'done');
    if (!pending.length) return { completed: [], spawned: [], skipped };

    return this.#mutate(`complete ${formatIds(pending.map((t) => t.id))}`, () => {
      const timestamp = this.now().toISOString();
      const spawned = [];
      for (const task of pending) {
        task.status = 'done';
        task.completedAt = timestamp;
        task.updatedAt = timestamp;
        if (task.recurrence) spawned.push(this.#spawnNext(task, timestamp));
      }
      return { completed: pending, spawned, skipped };
    });
  }

  #spawnNext(task, timestamp) {
    const today = this.today;
    let due = nextOccurrence(task.recurrence, task.due ?? today);
    // If the task was overdue, skip occurrences that are already in the past.
    while (due < today) due = nextOccurrence(task.recurrence, due);

    const next = {
      id: this.data.nextId++,
      title: task.title,
      status: 'pending',
      priority: task.priority,
      project: task.project,
      tags: [...task.tags],
      due,
      recurrence: task.recurrence,
      notes: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };
    this.data.tasks.push(next);
    return next;
  }

  reopen(ids) {
    const tasks = ids.map((id) => this.get(id));
    const done = tasks.filter((task) => task.status === 'done');
    const skipped = tasks.filter((task) => task.status !== 'done');
    if (!done.length) return { reopened: [], skipped };

    return this.#mutate(`reopen ${formatIds(done.map((t) => t.id))}`, () => {
      const timestamp = this.now().toISOString();
      for (const task of done) {
        task.status = 'pending';
        task.completedAt = null;
        task.updatedAt = timestamp;
      }
      return { reopened: done, skipped };
    });
  }

  remove(ids) {
    const tasks = ids.map((id) => this.get(id));
    return this.#mutate(`delete ${formatIds(ids)}`, () => {
      this.data.tasks = this.data.tasks.filter((task) => !tasks.includes(task));
      return tasks;
    });
  }

  addNote(id, text) {
    const task = this.get(id);
    if (!text || !text.trim()) throw new TaskError('Note text cannot be empty.');
    return this.#mutate(`note on #${id}`, () => {
      const timestamp = this.now().toISOString();
      task.notes.push({ text: text.trim(), createdAt: timestamp });
      task.updatedAt = timestamp;
      return task;
    });
  }

  /** Permanently remove all completed tasks. */
  clean() {
    const done = this.data.tasks.filter((task) => task.status === 'done');
    if (!done.length) return [];
    return this.#mutate(`clean ${done.length} completed task(s)`, () => {
      this.data.tasks = this.data.tasks.filter((task) => task.status !== 'done');
      return done;
    });
  }

  /** Import raw task objects (from JSON or CSV). Ids are always reassigned. */
  import(rawTasks, { replace = false } = {}) {
    const prepared = this.validateImport(rawTasks);
    return this.#mutate(`import ${prepared.length} task(s)`, () => {
      if (replace) {
        this.data.tasks = [];
        this.data.nextId = 1;
      }
      const imported = prepared.map((fields) => ({ id: this.data.nextId++, ...fields }));
      this.data.tasks.push(...imported);
      return imported;
    });
  }

  /** Check and normalize raw tasks for import without saving anything. */
  validateImport(rawTasks) {
    const timestamp = this.now().toISOString();
    return rawTasks.map((raw, index) => {
      try {
        const createdAt = validateTimestamp(raw.createdAt, timestamp);
        const status = validateStatus(raw.status || (raw.done ? 'done' : 'pending'));
        return {
          title: validateTitle(raw.title),
          status,
          priority: validatePriority(raw.priority || 'medium'),
          project: validateProject(raw.project),
          tags: validateTags(typeof raw.tags === 'string' ? raw.tags.split(/[\s,]+/).filter(Boolean) : raw.tags),
          due: validateDue(raw.due),
          recurrence: validateRecurrence(raw.recurrence),
          notes: validateNotes(raw.notes, createdAt),
          createdAt,
          updatedAt: validateTimestamp(raw.updatedAt, createdAt),
          completedAt: status === 'done' ? validateTimestamp(raw.completedAt, timestamp) : null,
        };
      } catch (err) {
        throw new TaskError(`Task ${index + 1} in import: ${err.message}`);
      }
    });
  }

  /** Restore the state from before the most recent change. */
  undo() {
    const history = this.storage.loadHistory();
    const entry = history.pop();
    if (!entry) throw new TaskError('Nothing to undo.');
    this.data = entry.snapshot;
    this.storage.save(this.data);
    this.storage.saveHistory(history);
    return entry;
  }

  history() {
    return this.storage
      .loadHistory()
      .map(({ description, timestamp }) => ({ description, timestamp }))
      .reverse();
  }

  projects() {
    return countBy(this.data.tasks, (task) => (task.project ? [task.project] : []));
  }

  tags() {
    return countBy(this.data.tasks, (task) => task.tags);
  }

  stats({ days = 7 } = {}) {
    const today = this.today;
    const tasks = this.data.tasks;
    const pending = tasks.filter((t) => t.status === 'pending');
    const done = tasks.filter((t) => t.status === 'done');

    const completionsByDay = new Map();
    for (const task of done) {
      const day = toISODate(new Date(task.completedAt));
      completionsByDay.set(day, (completionsByDay.get(day) ?? 0) + 1);
    }

    const recent = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = toISODate(addDays(this.now(), -i));
      recent.push({ date, count: completionsByDay.get(date) ?? 0 });
    }

    // A streak survives until the end of today, so start from yesterday if nothing is done yet.
    let streak = 0;
    let cursor = completionsByDay.has(today) ? this.now() : addDays(this.now(), -1);
    while (completionsByDay.has(toISODate(cursor))) {
      streak++;
      cursor = addDays(cursor, -1);
    }

    const durations = done.map(
      (t) => (Date.parse(t.completedAt) - Date.parse(t.createdAt)) / 86_400_000,
    );
    const byPriority = Object.fromEntries(
      PRIORITIES.map((p) => [p, pending.filter((t) => t.priority === p).length]),
    );

    return {
      total: tasks.length,
      pending: pending.length,
      done: done.length,
      overdue: pending.filter((t) => t.due && t.due < today).length,
      dueToday: pending.filter((t) => t.due === today).length,
      dueThisWeek: pending.filter((t) => t.due && t.due >= today && daysBetween(today, t.due) < 7)
        .length,
      completionRate: tasks.length ? done.length / tasks.length : 0,
      averageDaysToComplete: durations.length
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : null,
      streak,
      recent,
      byPriority,
      byProject: this.projects(),
    };
  }

  #mutate(description, apply) {
    const snapshot = structuredClone(this.data);
    const result = apply();
    this.storage.save(this.data);
    if (this.historyLimit > 0) {
      const history = this.storage.loadHistory();
      history.push({ description, timestamp: this.now().toISOString(), snapshot });
      this.storage.saveHistory(history.slice(-this.historyLimit));
    }
    return result;
  }
}

function countBy(tasks, keysOf) {
  const counts = new Map();
  for (const task of tasks) {
    for (const key of keysOf(task)) {
      const entry = counts.get(key) ?? { name: key, pending: 0, done: 0 };
      entry[task.status] += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { TaskService, validateTag, validateProject };
