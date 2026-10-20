'use strict';

const { UsageError } = require('./errors');

const SHELLS = ['bash', 'zsh', 'fish'];

function bashScript(commands) {
  const names = commands.flatMap((c) => [c.name, ...c.aliases]).join(' ');
  return `# task-manager-cli bash completion
# Add to ~/.bashrc:  eval "$(task completion bash)"
_task_completion() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${names} help" -- "$cur") )
    return
  fi
  case "$cur" in
    +*) COMPREPLY=( $(compgen -W "$(task tags --plain 2>/dev/null | sed 's/^/+/')" -- "$cur") ) ;;
    -*) COMPREPLY=( $(compgen -W "--help --json --no-color" -- "$cur") ) ;;
  esac
}
complete -F _task_completion task
`;
}

function zshScript(commands) {
  const entries = commands
    .map((c) => `    '${c.name}:${c.summary.replace(/'/g, "'\\''").replace(/:/g, '\\:')}'`)
    .join('\n');
  return `#compdef task
# task-manager-cli zsh completion
# Add to ~/.zshrc:  eval "$(task completion zsh)"
_task() {
  local -a commands
  commands=(
${entries}
    'help:Show help'
  )
  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi
  if compset -P '+'; then
    local -a tags
    tags=(\${(f)"$(task tags --plain 2>/dev/null)"})
    compadd -- $tags
    return
  fi
  if compset -P 'project:'; then
    local -a projects
    projects=(\${(f)"$(task projects --plain 2>/dev/null)"})
    compadd -- $projects
  fi
}
compdef _task task
`;
}

function fishScript(commands) {
  const lines = commands.map(
    (c) =>
      `complete -c task -n '__fish_use_subcommand' -a '${c.name}' -d '${c.summary.replace(/'/g, "\\'")}'`,
  );
  return `# task-manager-cli fish completion
# Save to ~/.config/fish/completions/task.fish:  task completion fish > ~/.config/fish/completions/task.fish
complete -c task -f
${lines.join('\n')}
complete -c task -n '__fish_use_subcommand' -a 'help' -d 'Show help'
complete -c task -n 'not __fish_use_subcommand' -a '(task tags --plain 2>/dev/null | sed "s/^/+/")'
complete -c task -n 'not __fish_use_subcommand' -a '(task projects --plain 2>/dev/null | sed "s/^/project:/")'
`;
}

function completionScript(shell, commands) {
  switch (shell) {
    case 'bash':
      return bashScript(commands);
    case 'zsh':
      return zshScript(commands);
    case 'fish':
      return fishScript(commands);
    default:
      throw new UsageError(`Unsupported shell "${shell ?? ''}". Use one of: ${SHELLS.join(', ')}.`);
  }
}

module.exports = { completionScript, SHELLS };
