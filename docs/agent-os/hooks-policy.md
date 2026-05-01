# Hooks Policy

Hooks are automatic actions around Claude Code tool usage. In this project they must be conservative.

## Safe hook ideas

- Warn before broad Bash commands.
- Block obviously destructive commands.
- Print verification hints after editing API/admin/citizen files.
- Append lightweight local timestamps to an operator log if explicitly enabled.

## Unsafe hook ideas

Do not use hooks to:

- auto-commit,
- auto-push,
- deploy,
- delete files,
- kill arbitrary processes,
- send external messages,
- call paid APIs,
- mutate secrets.

## Example scripts

- `.claude/hooks/pre-bash-guard.mjs`
- `.claude/hooks/post-change-check.mjs`

They are examples and should be enabled only after checking the current Claude Code settings schema. Keep them project-local and easy to disable.

## Activation rule

Hook activation is intentionally not forced in this repo. First test hook scripts manually, then enable them in `.claude/settings.json` only when the team agrees.
