# Reviewer configuration

Read `.agents/agentic-review.yaml` from the consuming repository. A repository may name another path in its agent instructions. The config selects the agent, model, and reasoning effort for each review aspect.

The file must use version `1` and define these profiles:

- `correctness_reliability`
- `security_privacy`
- `maintainability_tests`
- `spec_conformance` when an authoritative spec is available

Each profile must contain non-empty strings for `coding_agent`, `model`, and `reasoning_effort`. Validate the three core profiles before checkpointing. Resolve the spec before dispatch; if a spec is available, require and validate its profile before checkpointing too.

Reject malformed YAML, unsupported versions, missing fields, unsupported agent, model, or reasoning settings, and any remaining `CHANGE_ME` values. Report the exact invalid path and stop. Do not guess a replacement, fall back to the main agent's model, or silently skip a required aspect.

Use the project's configured values exactly. The same agent and model may serve more than one aspect, but keep each aspect in its own review context. Copy the example at [`../assets/agentic-review.example.yaml`](../assets/agentic-review.example.yaml) and replace every placeholder.

Pass `coding_agent` to the current runtime's documented agent selector, and pass `model` and `reasoning_effort` unchanged. If a value has no supported mapping in the current runtime, stop rather than guessing.

The `maintainability_tests` reviewer also checks applicable project coding and testing conventions. The other core reviewers apply only documented rules relevant to their assigned risk area.
