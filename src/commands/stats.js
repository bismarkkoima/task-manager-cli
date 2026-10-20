'use strict';

const { sparkline } = require('../format');
const { weekdayName } = require('../dates');

module.exports = {
  name: 'stats',
  aliases: ['summary', 'report'],
  summary: 'Show progress: totals, streak, recent completions and projects',
  usage: 'task stats',
  options: {},
  examples: ['task stats', 'task stats --json'],

  run(ctx) {
    const stats = ctx.service.stats();
    if (ctx.json) return ctx.printJson(stats);
    const { colors } = ctx;
    const row = (label, value) => `  ${colors.dim(label.padEnd(14))}${value}`;
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

    ctx.out(colors.bold('Overview'));
    ctx.out(row('Pending', stats.pending));
    ctx.out(row('Completed', colors.green(stats.done)));
    ctx.out(row('Overdue', stats.overdue ? colors.red(stats.overdue) : 0));
    ctx.out(row('Due today', stats.dueToday ? colors.yellow(stats.dueToday) : 0));
    ctx.out(row('Due this week', stats.dueThisWeek));
    ctx.out(row('Completion', `${Math.round(stats.completionRate * 100)}%`));
    if (stats.averageDaysToComplete !== null) {
      ctx.out(row('Avg. time', `${stats.averageDaysToComplete.toFixed(1)} days to complete`));
    }
    ctx.out(row('Streak', stats.streak ? colors.green(plural(stats.streak, 'day')) : '0 days'));

    const counts = stats.recent.map((day) => day.count);
    const total = counts.reduce((sum, n) => sum + n, 0);
    ctx.out('');
    ctx.out(colors.bold('Last 7 days'));
    ctx.out(`  ${colors.green(sparkline(counts))}  ${colors.dim(`${plural(total, 'task')} completed`)}`);
    ctx.out(`  ${colors.dim(stats.recent.map((day) => weekdayName(day.date)[0].toUpperCase()).join(''))}`);

    ctx.out('');
    ctx.out(colors.bold('Pending by priority'));
    ctx.out(
      `  ${colors.red(`high ${stats.byPriority.high}`)}  ${colors.yellow(`medium ${stats.byPriority.medium}`)}  ${colors.gray(`low ${stats.byPriority.low}`)}`,
    );

    if (stats.byProject.length) {
      ctx.out('');
      ctx.out(colors.bold('Projects'));
      const width = Math.max(...stats.byProject.map((p) => p.name.length));
      for (const project of stats.byProject) {
        const all = project.pending + project.done;
        const filled = Math.round((project.done / all) * 10);
        const bar = colors.green('■'.repeat(filled)) + colors.dim('□'.repeat(10 - filled));
        ctx.out(
          `  ${colors.magenta(project.name.padEnd(width))}  ${bar}  ${colors.dim(`${project.done}/${all} done`)}`,
        );
      }
    }
  },
};
