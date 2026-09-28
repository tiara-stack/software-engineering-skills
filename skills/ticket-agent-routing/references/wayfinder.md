# Wayfinder routing

Use this reference only when the consuming project uses Wayfinder and its
`wayfinder:*` issue labels.

Apply agent recommendations to newly created `wayfinder:research` child
tickets before Wayfinder dispatches a research worker. Classify research by its
breadth and ambiguity. Put the recommendation block at the top of the research
question.

Leave Wayfinder's child issue, blocking, claim, branch, and worker mechanics
unchanged. The Wayfinder agent reads the recommendation when dispatching that
ticket and chooses the configured agent, model, and reasoning setting for that
one worker. The block remains metadata. It never instructs a research worker to
spawn another agent or change Wayfinder's workflow.

A Wayfinder map describes a destination rather than executable work. Leave it
unrouted unless its body also asks an agent to perform a concrete task. Preserve
the map's labels and native blocking relationships.
