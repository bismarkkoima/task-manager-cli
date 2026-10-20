'use strict';

/** An expected failure caused by user input or the environment. */
class TaskError extends Error {
  constructor(message, { exitCode = 1 } = {}) {
    super(message);
    this.name = 'TaskError';
    this.exitCode = exitCode;
  }
}

/** The command line itself was malformed. */
class UsageError extends TaskError {
  constructor(message) {
    super(message, { exitCode: 2 });
    this.name = 'UsageError';
  }
}

module.exports = { TaskError, UsageError };
