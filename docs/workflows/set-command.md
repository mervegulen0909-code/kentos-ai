# Set Command Workflow

The `set` workflow initializes or refreshes repo context before implementation.

## Steps

1. Read repo contracts: `AGENTS.md`, `README.md`, `DESIGN.md`, `.interface-design/system.md`, and relevant `docs/workflows/**` files.
2. Inspect stack, package manager, commands, CI/deployment files, and current app structure.
3. Refresh official sources when the task touches framework decisions, design, Claude/Anthropic, MCP, Skills, deployment, or agent workflows.
4. Select only the modules/tools that directly help the task.
5. Produce a short implementation plan with assumptions, risks, files to change, verification commands, and approval gates.
6. Do not start heavy installs, deploys, training, credential changes, or public publishing without approval.

## Output

```text
Principal plan:
- Project lane:
- Current repo diagnosis:
- User goal:
- Non-goals:
- Key constraints:
- Assumptions:
- Risks:
- Research summary:
- Quality modules selected:
- Files to create/update:
- Testing strategy:
- Verification commands:
- Approval gates:
- Step-by-step execution plan:
```
