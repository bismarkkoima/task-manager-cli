'use strict';

const { TaskError } = require('./errors');
const { describeRecurrence } = require('./recurrence');

const FORMATS = ['json', 'csv', 'md'];
const CSV_COLUMNS = [
  'id',
  'title',
  'status',
  'priority',
  'project',
  'tags',
  'due',
  'recurrence',
  'notes',
  'createdAt',
  'completedAt',
];

/** Pick a format from an explicit flag or a file extension. */
function detectFormat(explicit, file) {
  const format = (explicit || (file && file.split('.').pop()) || 'json').toLowerCase();
  const normalized = format === 'markdown' ? 'md' : format;
  if (!FORMATS.includes(normalized)) {
    throw new TaskError(`Unsupported format "${format}". Use one of: ${FORMATS.join(', ')}.`);
  }
  return normalized;
}

function toJSON(tasks) {
  return `${JSON.stringify(tasks, null, 2)}\n`;
}

function csvField(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCSV(tasks) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const task of tasks) {
    const row = {
      ...task,
      tags: task.tags.join(' '),
      notes: task.notes.map((note) => note.text).join('\n'),
    };
    lines.push(CSV_COLUMNS.map((column) => csvField(row[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/** Group tasks by project as a Markdown checklist. */
function toMarkdown(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const key = task.project ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }
  const names = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));

  const lines = ['# Tasks', ''];
  for (const name of names) {
    lines.push(`## ${name || 'No project'}`, '');
    for (const task of groups.get(name)) {
      const details = [];
      if (task.due) details.push(`due ${task.due}`);
      if (task.priority !== 'medium') details.push(`${task.priority} priority`);
      if (task.recurrence) details.push(describeRecurrence(task.recurrence));
      const suffix = [
        details.length ? `(${details.join(', ')})` : '',
        task.tags.map((tag) => `#${tag}`).join(' '),
      ]
        .filter(Boolean)
        .join(' ');
      lines.push(`- [${task.status === 'done' ? 'x' : ' '}] ${task.title}${suffix ? ` ${suffix}` : ''}`);
      for (const note of task.notes) lines.push(`  - ${note.text.replace(/\n/g, ' ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function exportTasks(tasks, format) {
  switch (format) {
    case 'csv':
      return toCSV(tasks);
    case 'md':
      return toMarkdown(tasks);
    default:
      return toJSON(tasks);
  }
}

/** RFC 4180 CSV parser: handles quoted fields, escaped quotes and embedded newlines. */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (inQuotes) throw new TaskError('Invalid CSV: unterminated quoted field.');
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function fromCSV(text) {
  const [header, ...rows] = parseCSV(text);
  if (!header || !header.includes('title')) {
    throw new TaskError('CSV import needs a header row with at least a "title" column.');
  }
  return rows.map((cells) => {
    const record = Object.fromEntries(header.map((name, i) => [name.trim(), cells[i] ?? '']));
    return {
      ...record,
      notes: record.notes ? record.notes.split('\n') : [],
    };
  });
}

function fromJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new TaskError(`Invalid JSON: ${err.message}`);
  }
  const tasks = Array.isArray(data) ? data : data?.tasks;
  if (!Array.isArray(tasks)) {
    throw new TaskError('JSON import expects an array of tasks or an object with a "tasks" array.');
  }
  return tasks;
}

function importTasks(text, format) {
  if (format === 'csv') return fromCSV(text);
  if (format === 'json') return fromJSON(text);
  throw new TaskError(`Cannot import from "${format}". Use json or csv.`);
}

module.exports = { FORMATS, detectFormat, exportTasks, importTasks, parseCSV, toCSV, toMarkdown };
