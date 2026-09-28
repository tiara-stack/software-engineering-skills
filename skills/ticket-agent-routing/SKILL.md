---
name: ticket-agent-routing
description: Add configured coding-agent and reasoning recommendations to an approved set of tickets.
disable-model-invocation: true
---

# Ticket agent routing

Run this skill only when the user explicitly invokes it. Add a recommendation
for the developer or workflow choosing an agent for each ticket. The
recommendation is metadata. It does not assign the issue or tell the assigned
agent to spawn another agent.

## Route the tickets

1. Start with the user-approved ticket set from the conversation, tracker, or
   ticket-planning workflow. Preserve titles, acceptance criteria, parentage,
   labels, and blocking relationships.
2. Read and validate the repository's
   [routing configuration](references/configuration.md) before classifying any
   ticket. If a value is missing or invalid, identify it and point to the
   example config. Stop before classifying or editing issues instead of
   inventing a model or reasoning level.
3. Assign exactly one configured task level to each ticket. Judge by scope,
   risk, breadth, and ambiguity. For investigation tickets, assess the
   investigation rather than the implementation size:

   - `quick`: tiny, narrowly bounded implementation or factual investigation.
   - `focused`: localized fix, feature, or investigation with a clear scope.
   - `standard`: ordinary vertical slice or investigation across several
     layers, sources, or packages.
   - `complex`: cross-package, high-risk, or investigation-heavy work.
   - `architectural`: uncertain or system-shaping work with repo-wide effects.

   Choose a configured level rather than adding a new one to the issue. At a
   boundary, choose the higher level and explain the scope or risk in one short
   sentence.
4. Use the selected level's exact configured `coding_agent`, `model`, and
   `reasoning_effort` values to build the recommendation block:

   ```markdown
   > **Coding agent recommendation**
   >
   > - **Coding agent:** `<configured coding_agent>`
   > - **Task level:** `<level>`
   > - **Model:** `<configured model>`
   > - **Reasoning:** `<configured reasoning_effort>`
   >
   > This is routing metadata for the developer or workflow choosing an
   > appropriate agent. It does not instruct the assigned agent to spawn a
   > subagent. The developer may override it.
   ```

5. Add the block before the issue's existing body. If the ticket is not yet
   published, put it first in the body before publishing. If it already has a
   recommendation block, update that block in place instead of adding another.
   Keep the block at the top after later body edits. Add one concise sentence
   after it only when the classification needs explanation.
6. Publish or update tickets through the repository's configured tracker.
   Preserve issue status, assignment, labels, parentage, and relationships.
   Verify that every in-scope ticket has exactly one block with the exact
   configured values.

If the tracker is unavailable, present the recommendation blocks to the user
and report that publication is still outstanding. Do not claim the tickets were
updated.

## Wayfinder

When the project uses Wayfinder, read
[Wayfinder routing](references/wayfinder.md) for its research-ticket branch.
