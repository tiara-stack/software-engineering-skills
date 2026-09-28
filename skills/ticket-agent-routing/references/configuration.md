# Routing configuration

Read `.agents/ticket-routing.yaml` from the consuming repository before
classifying tickets. It is the source of truth for agent, model, and reasoning
settings. The repository can use another path when its instructions name that
file explicitly.

The file must use version `1` and define all five task levels: `quick`,
`focused`, `standard`, `complex`, and `architectural`. Each level must contain
non-empty strings for `coding_agent`, `model`, and `reasoning_effort`.
Reject missing values, malformed YAML, unsupported versions, and any remaining
`CHANGE_ME` placeholders. Stop and identify the invalid field before changing
ticket bodies.

Use the example at
[`../assets/ticket-routing.example.yaml`](../assets/ticket-routing.example.yaml)
to create a project config. Replace each placeholder with an agent name, model
identifier, and reasoning setting supported by the target environment.

Treat configured model identifiers and reasoning settings as opaque strings.
Copy them exactly into each ticket, including punctuation and case. Do not
select a different model because it sounds faster or stronger.
