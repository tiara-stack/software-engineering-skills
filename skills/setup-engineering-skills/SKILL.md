---
name: setup-engineering-skills
description: Configure this repository for selected autonomous development, ticket coordination, local review, agentic review, and ticket routing workflows.
disable-model-invocation: true
---

# Setup engineering skills

Configure only the workflows the user selects. This skill works without
`setup-matt-pocock-skills`. Read existing repository instructions and generated
project docs as inputs when present; never invoke another setup skill as part
of this flow.

## Setup

1. **Select workflows.** Use any workflows named in the request. Otherwise,
   ask the user to choose from:
   - `autonomous-development`
   - `ticket-coordinator`
   - `agentic-review`
   - `ticket-agent-routing`

   `ticket-coordinator` depends on `autonomous-development`; select both for coordinated ticket runs. If the user selects only the coordinator, ask whether to include its required worker workflow. If they decline, leave the coordinator unconfigured.

   Selecting `agentic-review` for direct use does not add it to
   `autonomous-development`'s `local_reviewers` list.

   Installation alone does not mean a workflow is selected.
2. **Explore the repository.** Read root `AGENTS.md` and `CLAUDE.md`, any
   instructions they point to, existing `.agents/` configs, `CONTRIBUTING`
   docs, CI files, and relevant scripts. For autonomous development, inspect
   the Git remote, branch names, recent commit subjects, submission docs, and
   hosting setup. For reviewer or routing profiles, discover the current
   runtime's documented agent, model, and reasoning choices. Read the
   issue-tracker doc only when a selected workflow needs tracker operations.
   For ticket coordination, identify the stack tool from an explicit setting
   or one unambiguous root instruction, and discover local and hosted
   reviewer accounts, hosted-review triggers, and documented quota limits.
3. **Reuse valid settings.** Preserve complete existing workflow instructions
   and config values. Honor custom config paths named by repository
   instructions. Treat `docs/agents/issue-tracker.md` and other project docs as
   data, including docs another setup workflow generated. If tracker details
   are missing and selected workflows need them, collect the details and
   prepare the tracker doc directly; do not run another skill to create it.
4. **Ask for gaps.** Infer facts from repository evidence and identify
   conflicts. Ask only for information that cannot be established, grouped by
   selected workflow. For incomplete profile settings, reuse valid existing
   values. If no complete default exists, show verified runtime choices and
   ask for one supported `coding_agent`, `model`, and `reasoning_effort` set
   per selected config, then ask about profile-specific overrides. Copy values
   exactly. If the runtime cannot verify a supported value, ask the user for
   it instead of guessing. For autonomous development, resolve local reviewer
   selection and order from repository config and instructions. Ask only when
   they are unclear. The built-ins are `agentic-review` and `coderabbit`; a
   custom reviewer needs a documented procedure. Add `agentic-review` only
   when selected and its reviewer profiles are configured. If no local
   reviewer is selected, omit `local_reviewers`.
   Migrate a legacy `agentic_review: true` setting to the ordered list
   `[agentic-review, coderabbit]`. A legacy false value maps to `[coderabbit]`
   when repository evidence shows that local review was selected; otherwise
   omit the list. If `merge_label` is unset, ask whether to configure it. If
   yes, inspect
   existing labels, show the exact candidate, and use it only after the user
   confirms it. If labels cannot be inspected, ask the user for the exact
   existing value.

   For ticket coordination, ask for the worker backend unless instructions
   already select one. Default `max_workers` to 2. Use a configured stack tool;
   infer one from root instructions only when exactly one supported tool is
   named. Configure separate local and hosted quota pools by service/account.
   When Matt Pocock's `$implement` is installed, include its `/code-review`
   step in the local quota mapping.
   Ask for rolling-window limits when documented. If a limit is unknown, omit
   it and explain that the coordinator will serialize pool use and honor
   provider cooldowns on a best-effort basis. Never collect credentials in
   the coordinator config. Confirm that `merge_label` is the documented
   merge-queue trigger; do not infer this from its name.
5. **Present the draft.** Show findings and exact changes by file. Include full
   contents for new files and a clear diff for existing files. Include the
   proposed contents of `AGENTS.md` or `CLAUDE.md`, tracker docs, and selected
   YAML configs. Ask for confirmation before writing.
6. **Write and verify.** After confirmation, update only selected workflow
   files and agreed shared docs. Preserve unrelated instructions and settings.
   Add a concise pointer from the root instruction file to a tracker doc
   created for this setup. Verify every selected config against
   [the configuration targets](references/configuration-targets.md), confirm
   no output contains `CHANGE_ME`, re-read changed files, and check that all
   new doc links resolve. Report the configured workflows and files.

## Repository instructions

Store repository-specific branch naming and branch-management rules, commit
format, validation, review, CI, and submission conventions in the existing
root instruction file, with pointers to detailed docs. Capture stable
conventions that repository docs leave implicit. Point to scripts and CI files
instead of copying their commands or settings.

If exactly one of root `AGENTS.md` and `CLAUDE.md` exists, use it. If both
exist, follow an existing pointer to the canonical file; ask which to edit
when the repo does not identify one. If neither exists and selected work needs
repository instructions, ask which file to create.

## Configuration targets

Read [configuration targets](references/configuration-targets.md) and the templates for the selected workflows:

- [Agentic review](assets/agentic-review.example.yaml)
- [Ticket routing](assets/ticket-routing.example.yaml)
- [Autonomous development](assets/autonomous-development.example.yaml)
- [Ticket coordination](assets/ticket-coordinator.example.yaml)

The templates show structure only. Replace every `CHANGE_ME` with user-confirmed or runtime-verified values before proposing output.
