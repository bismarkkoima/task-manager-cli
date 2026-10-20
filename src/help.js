'use strict';

const GLOBAL_OPTIONS = {
  json: { type: 'boolean', description: 'Print machine-readable JSON' },
  'no-color': { type: 'boolean', description: 'Disable colored output' },
  file: { type: 'string', description: 'Use a different task file' },
  help: { type: 'boolean', short: 'h', description: 'Show help' },
  version: { type: 'boolean', short: 'v', description: 'Show the version' },
};

function optionLines(options) {
  const rows = Object.entries(options).map(([name, spec]) => {
    const flag = `${spec.short ? `-${spec.short}, ` : '    '}--${name}${spec.type === 'string' ? ' <value>' : ''}`;
    return [flag, spec.description ?? ''];
  });
  const width = Math.max(...rows.map(([flag]) => flag.length));
  return rows.map(([flag, description]) => `  ${flag.padEnd(width)}  ${description}`);
}

function generalHelp(commands, { version, colors }) {
  const width = Math.max(...commands.map((c) => [c.name, ...c.aliases.slice(0, 1)].join(', ').length));
  const commandLines = commands.map((c) => {
    const names = [c.name, ...c.aliases.slice(0, 1)].join(', ');
    return `  ${colors.bold(names.padEnd(width))}  ${c.summary}`;
  });
  return [
    `${colors.bold('task')} ${version} — a personal task manager for your terminal`,
    '',
    `${colors.bold('Usage:')} task [command] [arguments] [options]`,
    '',
    colors.bold('Commands:'),
    ...commandLines,
    `  ${colors.bold('completion'.padEnd(width))}  Print a shell completion script (bash, zsh, fish)`,
    `  ${colors.bold('help'.padEnd(width))}  Show help for a command`,
    '',
    colors.bold('Modifiers') + ' (for add, edit, list, search, export):',
    '  +tag  project:<name>  due:<date>  pri:<h|m|l>  recur:<rule>  status:<pending|done|all>',
    '',
    `${colors.bold('Dates:')} 2026-12-24, today, tomorrow, mon..sun, next fri, +3d, 2w, in 5 days, eow, eom, nextweek`,
    `${colors.bold('Repeat:')} daily, weekly, weekdays, monthly, yearly, "every 2 weeks", 3d`,
    '',
    colors.bold('Global options:'),
    ...optionLines(GLOBAL_OPTIONS),
    '',
    'Running "task" alone lists pending tasks; "task <id>" shows a task.',
    'Run "task help <command>" for details and examples.',
  ];
}

function commandHelp(command, { colors }) {
  const lines = [`${colors.bold(command.name)} — ${command.summary}`, '', `${colors.bold('Usage:')} ${command.usage}`];
  if (command.aliases.length) lines.push(`${colors.bold('Aliases:')} ${command.aliases.join(', ')}`);
  if (Object.keys(command.options).length) {
    lines.push('', colors.bold('Options:'), ...optionLines(command.options));
  }
  if (command.notes?.length) lines.push('', ...command.notes);
  if (command.examples?.length) {
    lines.push('', colors.bold('Examples:'), ...command.examples.map((example) => `  ${example}`));
  }
  return lines;
}

module.exports = { GLOBAL_OPTIONS, generalHelp, commandHelp };
