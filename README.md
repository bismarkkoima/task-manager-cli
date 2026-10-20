# task-manager-cli

[![CI](https://github.com/bismarkkoima/task-manager-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/bismarkkoima/task-manager-cli/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Dependencies](https://img.shields.io/badge/dependencies-0-blue)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

A fast, dependency-free personal task manager for your terminal.

```
$ task
ID  Pri  Due       Project       Title                    Tags
 1  H    2d ago    work          Finish quarterly report  +urgent
 2  M    tomorrow                Buy groceries            +errands
 3  M    Sat ↻     home          Water plants
 5  L    Oct 31                  Renew passport
 4  M              home.reading  Read a book [1]

5 tasks · 1 overdue
```

## Features

- **Fast capture.** Write tasks the way you think: `task add Call the bank due:fri pri:h +finance`
- **Natural-language dates.** Use `today`, `tomorrow`, `fri`, `next monday`, `+3d`, `2w`, `in 5 days`, `eow`, `eom` or `2026-12-24`
- **Recurring tasks.** `recur:weekly`, `weekdays`, `monthly` or `every 2 weeks`. Completing one schedules the next.
- **Projects and tags.** Nested projects (`work.reports`) and any number of `+tags`
- **Smart sorting.** An urgency score blends priority, due date and age, so the most important task is on top.
- **Powerful filters.** Combine `project:`, `+tag`, `pri:`, `due:overdue|today|week` and free-text search.
- **Undo anything.** Every change is reversible with `task undo`.
- **Notes.** Attach running notes to any task.
- **Stats.** See your completion rate, streak, a 7-day sparkline and per-project progress.
- **Import and export.** JSON, CSV and Markdown, for backups, spreadsheets or sharing a checklist.
- **Script-friendly.** `--json` on every command, plus predictable exit codes and `NO_COLOR` support.
- **Shell completion.** Supports bash, zsh and fish.
- **Safe storage.** Plain JSON with atomic writes. A corrupted file is reported and never overwritten.
- **Zero runtime dependencies.** Only Node.js is needed.

## Installation

Requires **Node.js 20 or newer**.

```bash
git clone https://github.com/bismarkkoima/task-manager-cli.git
cd task-manager-cli
npm link          # installs the `task` command globally
```

To uninstall: `npm unlink -g task-manager-cli`.

## Quick start

```bash
task add Finish quarterly report project:work pri:h due:fri +urgent
task add Buy groceries +errands due:tomorrow
task add Water plants recur:weekly due:sat
task                      # list pending tasks, most urgent first
task done 2               # complete a task
task 1                    # show details of task 1
task undo                 # changed your mind? revert the last change
```

## Commands

| Command | Aliases | Description |
| --- | --- | --- |
| `task add <title...>` | `a`, `new` | Add a task |
| `task list [filters]` | `ls`, `l` | List tasks (pending by default) |
| `task search <text>` | `find`, `grep` | Search titles and notes of all tasks |
| `task show <id...>` | `info`, `view` | Show full details (`task 3` also works) |
| `task done <id...>` | `complete`, `do` | Mark tasks complete |
| `task reopen <id...>` | `undone` | Mark completed tasks pending again |
| `task edit <id...> [changes]` | `modify`, `mod`, `e` | Change title, priority, project, tags, due date or recurrence |
| `task note <id> [text...]` | `annotate`, `n` | Add a note, or list a task's notes |
| `task delete <id...>` | `rm`, `del` | Delete tasks |
| `task projects` | | List projects with counts |
| `task tags` | | List tags with counts |
| `task stats` | `summary` | Show progress and streaks |
| `task clean` | `clear` | Delete all completed tasks |
| `task undo [--list]` | | Revert the last change, or list the undo history |
| `task export` | | Export as JSON, CSV or Markdown |
| `task import <file>` | | Import from JSON or CSV |
| `task config` | | View or change settings |
| `task completion <shell>` | | Print a shell completion script |
| `task help [command]` | | Show help |

Every command accepts `--help`, and most accept `--json`. Ids can be given as lists or ranges: `task done 1 3 5-7` or `task rm 2,4`.

### Modifiers

Modifiers can be mixed into the words of `add`, `edit`, `list`, `search` and `export`:

| Modifier | Example | Meaning |
| --- | --- | --- |
| `+tag` | `+errands` | Add a tag, or filter by it |
| `project:<name>` | `project:work.reports` | Set or filter by project (alias `pro:`) |
| `due:<date>` | `due:fri`, `due:+3d` | Set a due date, or filter by one |
| `pri:<h\|m\|l>` | `pri:h` | Set or filter by priority (alias `priority:`) |
| `recur:<rule>` | `recur:weekly` | Make a task repeat |
| `status:<s>` | `status:all` | Filter by `pending`, `done` or `all` |

Use `none` to clear a field when editing: `task edit 4 project:none due:none`.
A quoted argument that contains spaces is always part of the title, so `task add "+1 the proposal"` works as expected.

Each modifier also has an option form, such as `-p high`, `-P work`, `-d tomorrow`, `-t errands` and `-r weekly`.

### Dates

| Input | Meaning |
| --- | --- |
| `2026-12-24` | That date |
| `today`, `tomorrow`, `yesterday` | Relative days |
| `mon` … `sun`, `next friday` | The next such weekday after today |
| `+3d`, `2w`, `1m`, `-1d`, `in 5 days` | Offsets in days, weeks, months or years |
| `eow`, `eom`, `eoy` | End of week (Sunday), month or year |
| `nextweek`, `nextmonth` | The next Monday, or the 1st of next month |

### Recurrence

`daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`, `weekdays`, `every 3 days`, `2w`, …

When you complete a recurring task, a new task is created for the next occurrence. Occurrences that are already in the past are skipped, so completing an overdue daily task schedules it for today, not for a missed day.

### Filtering and sorting

```bash
task ls project:work                 # includes sub-projects like work.reports
task ls +errands due:week            # tagged errands due within 7 days
task ls --overdue
task ls pri:h --sort due
task ls --all --sort created --reverse
task ls -n 5                         # top 5 most urgent
task search dentist                  # searches titles and notes, including completed tasks
```

`due:<date>` matches tasks due **on or before** that date, so `due:today` includes overdue tasks.

Sort keys: `urgency` (default), `due`, `priority`, `created`, `id`, `title`. The urgency score is shown in `task show`.

### Undo

Every change, including adds, edits, completions, deletes, cleans and imports, can be undone:

```bash
task undo --list    # see what can be undone
task undo           # revert the most recent change
```

The last 20 changes are kept by default. You can change this with `task config set historyLimit <n>`.

### Import and export

```bash
task export > backup.json                       # everything, as JSON
task export --output tasks.csv                  # format inferred from extension
task export project:work --pending --format md  # Markdown checklist
task import backup.json                         # add tasks from a file
task import tasks.csv --dry-run                 # validate without saving
cat tasks.json | task import -                  # read from stdin
task import backup.json --replace               # replace your whole list
```

Imported tasks get new ids. The CSV columns are `id, title, status, priority, project, tags, due, recurrence, notes, createdAt, completedAt`. Only `title` is required.

### Stats

```
$ task stats
Overview
  Pending       4
  Completed     2
  Overdue       0
  Due today     0
  Due this week 1
  Completion    33%
  Avg. time     1.5 days to complete
  Streak        3 days

Last 7 days
  ··▂·▅▃█  9 tasks completed
  WTFSSMT

Pending by priority
  high 1  medium 2  low 1

Projects
  home          ■■■■■□□□□□  1/2 done
  work          ■■■■■■■■□□  4/5 done
```

## Configuration

```bash
task config                              # show all settings
task config set defaultSort due
task config set dataFile ~/Dropbox/tasks.json
task config unset defaultSort
```

| Key | Default | Description |
| --- | --- | --- |
| `defaultCommand` | `list` | What `task` runs with no arguments (`list`, `stats`, `projects`, `tags`) |
| `defaultPriority` | `medium` | Priority for new tasks |
| `defaultSort` | `urgency` | Sort order for `task list` |
| `color` | `true` | Colored output |
| `historyLimit` | `20` | Number of changes `task undo` can revert (0 disables undo) |
| `dataFile` | (see below) | Where tasks are stored |

### Files and environment variables

| What | Default location | Override |
| --- | --- | --- |
| Tasks | `~/.local/share/task-cli/tasks.json` (`$XDG_DATA_HOME`) | `--file <path>`, `TASKS_FILE`, or `dataFile` setting |
| Settings | `~/.config/task-cli/config.json` (`$XDG_CONFIG_HOME`) | `TASK_CONFIG` |
| Undo history | Next to the task file (`tasks.json.history.json`) | |

Other environment variables:

- `NO_COLOR` disables colors.
- `FORCE_COLOR` enables colors even when output is not a terminal.
- `DEBUG=1` prints stack traces for unexpected errors.

Keeping the task file in a synced folder (Dropbox, iCloud, Syncthing) lets you share your list across machines.

## Shell completion

```bash
# bash: add to ~/.bashrc
eval "$(task completion bash)"

# zsh: add to ~/.zshrc
eval "$(task completion zsh)"

# fish
task completion fish > ~/.config/fish/completions/task.fish
```

Completion covers commands and your existing `+tags`. In zsh and fish it also covers `project:` names.

## Scripting

Every listing command supports `--json`:

```bash
task ls --json | jq -r '.[] | select(.priority == "high") | .title'
task stats --json | jq .streak
```

Exit codes: `0` means success, `1` means an error (such as a task not found or invalid input) and `2` means invalid usage (such as an unknown command or option).

## Project structure

```
bin/task.js          Executable entry point
src/cli.js           Argument parsing, command dispatch and error handling
src/commands/        One module per command
src/tasks.js         TaskService: business rules, recurrence, undo and stats
src/storage.js       JSON persistence with atomic writes
src/query.js         Modifier parsing, filters and id ranges
src/dates.js         Natural-language date parsing
src/recurrence.js    Recurrence rules
src/sort.js          Urgency score and sort orders
src/format.js        Tables, colors and detail views
src/exporters.js     JSON, CSV and Markdown import/export
src/config.js        Settings
test/                node:test suites
```

## Development

```bash
npm install          # dev tools only (ESLint)
npm test             # run the test suite
npm run lint         # lint
npm run check        # lint and test
npm run test:coverage
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) © Bismark Koima
