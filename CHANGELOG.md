# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-20

### Added

- Task commands: `add`, `list`, `search`, `show`, `done`, `reopen`, `edit`, `note`, `delete` and `clean`.
- Inline modifiers: `+tag`, `project:`, `due:`, `pri:`, `recur:` and `status:`.
- Natural-language due dates: `today`, `tomorrow`, weekday names, `+3d`, `2w`, `eow`, `eom`, `nextweek` and more.
- Recurring tasks: completing one schedules the next occurrence.
- Nested projects and tags, with `projects` and `tags` overviews.
- Urgency-based default sorting, plus sorting by due date, priority, creation time, id or title.
- `undo` for every change, with a configurable history size.
- `stats` with completion rate, streak, a 7-day sparkline and per-project progress.
- Import from JSON and CSV, and export to JSON, CSV and Markdown.
- `config` command and an XDG-compliant config and data location.
- `--json` output for scripting and shell completion for bash, zsh and fish.
- Atomic writes and protection against overwriting corrupted data files.
