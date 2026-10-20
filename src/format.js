'use strict';

const { describeDate, formatTimestamp, weekdayName } = require('./dates');
const { describeRecurrence } = require('./recurrence');
const { urgency } = require('./sort');

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

const STYLES = {
  bold: 1,
  dim: 2,
  italic: 3,
  underline: 4,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  gray: 90,
};

/** Returns style functions that are no-ops when colors are disabled. */
function createColors(enabled) {
  const colors = {};
  for (const [name, code] of Object.entries(STYLES)) {
    colors[name] = enabled ? (text) => `\x1b[${code}m${text}\x1b[0m` : (text) => String(text);
  }
  return colors;
}

const stripAnsi = (text) => String(text).replace(ANSI_PATTERN, '');
const visibleLength = (text) => [...stripAnsi(text)].length;

function truncate(text, width) {
  const chars = [...text];
  if (chars.length <= width) return text;
  if (width <= 1) return chars.slice(0, width).join('');
  return `${chars.slice(0, width - 1).join('')}…`;
}

function padCell(text, width, align) {
  const gap = ' '.repeat(Math.max(0, width - visibleLength(text)));
  return align === 'right' ? gap + text : text + gap;
}

/**
 * Render rows as an aligned table. Each cell is `{ text, style }`; widths are
 * measured on plain text and the `flex` column is truncated to fit `maxWidth`.
 */
function renderTable(columns, rows, { maxWidth = 100, colors, gap = 2 } = {}) {
  const visible = columns.filter((col) => !col.optional || rows.some((row) => row[col.key]?.text));
  const widths = visible.map((col) =>
    Math.max(col.header.length, ...rows.map((row) => [...(row[col.key]?.text ?? '')].length)),
  );

  const total = widths.reduce((sum, w) => sum + w, 0) + gap * (visible.length - 1);
  const flexIndex = visible.findIndex((col) => col.flex);
  if (total > maxWidth && flexIndex !== -1) {
    widths[flexIndex] = Math.max(10, widths[flexIndex] - (total - maxWidth));
  }

  const spacer = ' '.repeat(gap);
  const header = visible
    .map((col, i) => padCell(col.header, widths[i], col.align))
    .join(spacer)
    .trimEnd();
  const lines = [colors.underline(header)];
  for (const row of rows) {
    const cells = visible.map((col, i) => {
      const cell = row[col.key] ?? { text: '' };
      const text = truncate(cell.text, widths[i]);
      return padCell(cell.style ? cell.style(text) : text, widths[i], col.align);
    });
    lines.push(cells.join(spacer).trimEnd());
  }
  return lines;
}

const PRIORITY_LABELS = { high: 'H', medium: 'M', low: 'L' };

function priorityStyle(priority, colors) {
  return { high: colors.red, medium: colors.yellow, low: colors.gray }[priority];
}

function dueCell(task, today, colors) {
  if (!task.due) return { text: '' };
  const label = describeDate(task.due, today) + (task.recurrence ? ' ↻' : '');
  if (task.status === 'done') return { text: label, style: colors.dim };
  if (task.due < today) return { text: label, style: colors.red };
  if (task.due === today) return { text: label, style: colors.yellow };
  return { text: label, style: colors.cyan };
}

const TASK_COLUMNS = [
  { key: 'id', header: 'ID', align: 'right' },
  { key: 'priority', header: 'Pri' },
  { key: 'due', header: 'Due', optional: true },
  { key: 'project', header: 'Project', optional: true },
  { key: 'title', header: 'Title', flex: true },
  { key: 'tags', header: 'Tags', optional: true },
];

function renderTaskTable(tasks, { today, colors, maxWidth }) {
  const rows = tasks.map((task) => {
    const done = task.status === 'done';
    const noteCount = task.notes.length ? ` [${task.notes.length}]` : '';
    return {
      id: { text: String(task.id), style: colors.dim },
      priority: {
        text: PRIORITY_LABELS[task.priority],
        style: done ? colors.dim : priorityStyle(task.priority, colors),
      },
      due: dueCell(task, today, colors),
      project: { text: task.project ?? '', style: done ? colors.dim : colors.magenta },
      title: {
        text: `${done ? '✔ ' : ''}${task.title}${noteCount}`,
        style: done ? colors.dim : undefined,
      },
      tags: { text: task.tags.map((tag) => `+${tag}`).join(' '), style: colors.blue },
    };
  });
  return renderTable(TASK_COLUMNS, rows, { maxWidth, colors });
}

function summarizeTasks(tasks, today) {
  const pending = tasks.filter((t) => t.status === 'pending');
  const overdue = pending.filter((t) => t.due && t.due < today).length;
  const dueToday = pending.filter((t) => t.due === today).length;
  const parts = [`${tasks.length} task${tasks.length === 1 ? '' : 's'}`];
  if (overdue) parts.push(`${overdue} overdue`);
  if (dueToday) parts.push(`${dueToday} due today`);
  return parts.join(' · ');
}

/** A one-line description used in confirmation messages. */
function taskLine(task, colors) {
  return `${colors.dim(`#${task.id}`)} ${task.title}`;
}

function renderTaskDetail(task, { today, colors }) {
  const label = (text) => colors.dim(text.padEnd(11));
  const statusText =
    task.status === 'done' ? colors.green('done') : task.due && task.due < today ? colors.red('overdue') : 'pending';
  const lines = [
    `${colors.bold(`#${task.id}`)} ${colors.bold(task.title)}`,
    `  ${label('Status')}${statusText}`,
    `  ${label('Priority')}${priorityStyle(task.priority, colors)(task.priority)}`,
  ];
  if (task.project) lines.push(`  ${label('Project')}${colors.magenta(task.project)}`);
  if (task.tags.length) {
    lines.push(`  ${label('Tags')}${colors.blue(task.tags.map((t) => `+${t}`).join(' '))}`);
  }
  if (task.due) {
    const weekday = weekdayName(task.due).slice(0, 3);
    lines.push(
      `  ${label('Due')}${task.due} (${weekday}, ${describeDate(task.due, today)})`,
    );
  }
  if (task.recurrence) lines.push(`  ${label('Repeats')}${describeRecurrence(task.recurrence)}`);
  if (task.status === 'pending') lines.push(`  ${label('Urgency')}${urgency(task, today)}`);
  lines.push(`  ${label('Created')}${formatTimestamp(task.createdAt)}`);
  if (task.updatedAt !== task.createdAt) {
    lines.push(`  ${label('Modified')}${formatTimestamp(task.updatedAt)}`);
  }
  if (task.completedAt) lines.push(`  ${label('Completed')}${formatTimestamp(task.completedAt)}`);
  if (task.notes.length) {
    lines.push(`  ${colors.dim('Notes')}`);
    for (const note of task.notes) {
      lines.push(`    ${colors.dim(formatTimestamp(note.createdAt))}  ${note.text}`);
    }
  }
  return lines;
}

const SPARK_BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/** Render counts as a unicode sparkline, e.g. ▁▃▅█. */
function sparkline(values) {
  const max = Math.max(...values, 1);
  return values
    .map((value) =>
      value === 0 ? '·' : SPARK_BLOCKS[Math.min(7, Math.ceil((value / max) * 8) - 1)],
    )
    .join('');
}

module.exports = {
  createColors,
  stripAnsi,
  visibleLength,
  truncate,
  renderTable,
  renderTaskTable,
  renderTaskDetail,
  summarizeTasks,
  taskLine,
  sparkline,
};
