# Configuration and tool discovery

Read project-owned instructions first. Check root `AGENTS.md`, `CLAUDE.md`,
`CONTEXT.md`, package scripts, CI files, issue-tracker docs, and the Git remote
as relevant to the selected route. Prefer a documented repository convention
over an installed tool's default.

The optional `.agents/autonomous-development.yaml` file can select local
reviewers and carry the merge-readiness label:

```yaml
local_reviewers:
  - agentic-review
  - coderabbit
merge_label: "ready-for-merge"
```

`local_reviewers` is an ordered YAML sequence. Its built-in identifiers are
`agentic-review` and `coderabbit`. A repository can use another identifier
when its own instructions define that review procedure. When the key is
present, it is authoritative, including an empty list, unless the user selects
a different reviewer for the current run. When it is absent, follow explicit
repository instructions to select and order local reviewers. Tool installation
alone does not select a reviewer.

`agentic_review` is retired. If it appears in project config, stop before
mutation and migrate the project to `local_reviewers`. The previous
`agentic_review: true` configuration enabled Agentic Review before CodeRabbit,
so migrate that setup to both entries in the example. Use only `coderabbit`
when repository evidence shows that the project selected CodeRabbit alone, or
only `agentic-review` when it selected Agentic Review alone. Omit the list
when no local review is selected. A former `agentic_review: false` setting
means CodeRabbit alone when the project used the local review loop; omit the
list when the project did not select local review.

A custom reviewer procedure must define its invocation, review scope,
completion signal, and failure handling. Report a blocker when those details
are missing.

Local reviewer selection does not configure hosted pull request reviews.
Resolve hosted reviewers from repository instructions and hosting-platform
configuration. Do not infer hosted review from the local reviewer list.

Read `merge_label` when the route applies a label. Routes whose terminal
criterion requires a label need a non-empty value that already exists in the
target repository. `implement` applies this label when configured and its
submission workflow uses a pull request. Never invent or create a replacement
label. Projects can store the same value in another config file if their agent
instructions identify that file as the source of truth.

Resolve integrations from the request, project docs, Git remotes, and installed
tools. For example, a GitHub remote plus `gh` can identify GitHub operations;
`gt` matters only when the project documents Graphite. Check availability only
for selected tools. A configured tracker or reviewer must be reachable before
a route depends on it. Report a missing tool or permission as a blocker. Do
not silently switch trackers, reviewers, or hosting services.

Use the configured issue tracker only when an issue is supplied or the route
needs an issue update. A repository may have no external tracker. In that
case, work from the user's request and follow the repository's local
completion convention.
