# Contributing

Thanks for your interest in improving task-manager-cli!

## Getting started

```bash
git clone https://github.com/bismarkkoima/task-manager-cli.git
cd task-manager-cli
npm install
npm link        # optional: use your working copy as the `task` command
```

## Before opening a pull request

1. Add or update tests in `test/` for any behavior you change.
2. Run `npm run check` (lint and tests) and make sure it passes.
3. Update `README.md` if you add or change a command, option or setting.
4. Add an entry under **Unreleased** in `CHANGELOG.md`.

## Guidelines

- **No runtime dependencies.** The CLI uses only the Node.js standard library. Dev dependencies are fine.
- **One command per file** in `src/commands/`. Each module exports `name`, `aliases`, `summary`, `usage`, `options`, `examples` and `run(ctx, args)`, and must be registered in `src/commands/index.js`.
- **Business rules live in `TaskService`** (`src/tasks.js`). Commands parse input and format output. They should not modify tasks directly.
- **Every change goes through `TaskService#mutate`** so it is saved atomically and can be undone.
- **User-facing errors** throw `TaskError` (exit code 1) or `UsageError` (exit code 2) with a clear, actionable message.
- **Tests use a fixed clock** (`test/helpers.js`), so date-dependent behavior is deterministic.

## Reporting bugs

Please include your Node.js version (`node --version`), the command you ran, what you expected and what happened.
