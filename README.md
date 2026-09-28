# Shareable engineering skills

Each skill lives in its own folder under `skills/`. The folder contains a
`SKILL.md` and any references the workflow needs. Skills use the Agent Skills
directory layout, so an installer can select one skill without copying this
whole repository.

## Skills

| Skill | Use |
| --- | --- |
| [`autonomous-development`](skills/autonomous-development/SKILL.md) | Run configured implementation and pull request workflows, including coordinator-delegated worker phases. |
| [`ticket-coordinator`](skills/ticket-coordinator/SKILL.md) | Coordinate an approved ticket batch across workers, dependency gates, stacked PRs, review quotas, and post-merge cleanup. |
| [`agentic-review`](skills/agentic-review/SKILL.md) | Run a configured, incremental multi-agent review with Git checkpoints and a local text ledger. |
| [`ticket-agent-routing`](skills/ticket-agent-routing/SKILL.md) | Add configured coding-agent and reasoning recommendations to approved tickets. |
| [`setup-engineering-skills`](skills/setup-engineering-skills/SKILL.md) | Configure selected engineering workflows for a consuming repository. |

## Install

With the [skills installer](https://github.com/vercel-labs/skills), choose this
repository and select the skill you want. To install one directly:

```sh
npx skills@latest add <owner>/<repo> --skill=autonomous-development
npx skills@latest add <owner>/<repo> --skill=ticket-coordinator
npx skills@latest add <owner>/<repo> --skill=agentic-review
npx skills@latest add <owner>/<repo> --skill=ticket-agent-routing
npx skills@latest add <owner>/<repo> --skill=setup-engineering-skills
```

You can also copy a skill folder into an agent's supported skills directory.
Keep the whole folder together so relative links to its references continue to
work.

## Project setup

The skill files stay in this repository. Use `setup-engineering-skills` to
configure only the workflows a consuming project selects. It records local
branch, commit, review, CI, and submission conventions, and creates the agent
profiles required by the selected workflows.

The setup skill works without `setup-matt-pocock-skills`. If the consuming
project already has `docs/agents/issue-tracker.md` or other generated project
docs, it reads them as configuration. It does not invoke the other setup skill.
Its profile templates are kept alongside the individual skills' examples so it
can be installed on its own; keep those copies in sync when a config changes.

For manual setup, `ticket-agent-routing` needs per-project model choices. Copy
[`ticket-routing.example.yaml`](skills/ticket-agent-routing/assets/ticket-routing.example.yaml)
to `.agents/ticket-routing.yaml` and replace every `CHANGE_ME` value with a
supported coding agent, model ID, and reasoning setting. The skill stops when
that configuration is missing or incomplete.

`agentic-review` needs per-project reviewer settings. Copy
[`agentic-review.example.yaml`](skills/agentic-review/assets/agentic-review.example.yaml)
to `.agents/agentic-review.yaml` and set an agent, model, and reasoning effort for each
review aspect. Set the spec reviewer when an authoritative spec is available. The skill
stops before checkpointing if a required profile is missing or invalid.

`autonomous-development` reads optional settings from
`.agents/autonomous-development.yaml`. List local reviewers in execution order
under `local_reviewers`:

```yaml
local_reviewers:
  - agentic-review
  - coderabbit
merge_label: "ready-for-merge"
```

The built-in reviewer identifiers are `agentic-review` and `coderabbit`.
Document any other review procedure in the consuming repository. Without a
selected local reviewer, `implement` skips local review and the explicit
`local-review-loop` route stops with a configuration blocker. The retired
`agentic_review: true` setting maps to both entries above. A former `false`
value maps to `coderabbit` when the project used local review. `merge_label`
must name an existing repository label; routes that require it stop when it
is missing or invalid. Configure hosted pull-request reviewers separately in
the repository and hosting platform.

`ticket-coordinator` depends on `autonomous-development`; install both skills
to use coordinated worker handoffs. Copy
[`ticket-coordinator.example.yaml`](skills/ticket-coordinator/assets/ticket-coordinator.example.yaml)
to `.agents/ticket-coordinator.yaml` or the path named in the consuming
project's root instructions. Set the worker backend, stack tool, and local and
hosted reviewer quota pools for that project. The stack tool can be inferred
from root instructions only when they name one clear choice. Rolling-window
limits are optional when a service does not publish a usable value; the
coordinator still serializes active use and honors provider cooldowns. When
Matt Pocock's `$implement` is installed, its `/code-review` step belongs in a
local quota pool and the full test suite runs after stack rebase and review
repairs.

## Sources

- `autonomous-development` consolidates the versions maintained in the
  TiaraStack and T3Code MCP repositories.
- `agentic-review` adapts TiaraStack's checkpointed review flow with local Git
  refs and text records instead of a database or dependency graph.
- `ticket-agent-routing` consolidates the versions maintained in the TiaraStack
  and T3Code MCP repositories.
