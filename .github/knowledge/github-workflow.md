# GitHub work routing

GitHub Issues and Project fields are the shared work queue. Project status identifies the waiting queue or current state. Agent assignment is the explicit start signal, except for incidents.

## Labels and default routes

| Label | Meaning | Default route |
|---|---|---|
| `enhancement` | New feature or capability | To Do → Ready for Development + agent assignment → In Progress |
| `problem` | Something should work better, not yet a confirmed defect | Triage + agent assignment → In Progress |
| `bug` | Expected behavior is not working | Triage + agent assignment → In Progress |
| `enabler` | Technical debt, architecture, platform or engineering enablement | To Do → Ready for Development + agent assignment → In Progress |
| `documentation` | Documentation addition or correction | To Do → Ready for Development + agent assignment → In Progress |
| `incident` | Active outage, unavailable feature or serious degradation | To Do → immediate dispatch → In Progress |

## Project statuses

```text
To Do
Triage
Ready for Development
In Progress
Ready for QA
Monitoring
Done
```

## Activation rules

### To Do

- `To Do` is the owner's passive backlog.
- A non-incident item in `To Do` must not be analyzed, implemented or modified by an agent.
- Assignment alone must not bypass this backlog gate for a non-incident item.
- An `incident` is the only exception: adding an incident to the Project is an immediate activation signal. Route it to the Orchestrator and Incident Manager and move it to `In Progress` without waiting for a separate assignment by the owner.

### Triage

- `Triage` is the waiting queue for `bug` and `problem` items.
- Moving an item to `Triage` does not start work by itself.
- Assigning or explicitly invoking the FURA Orchestrator while the item is in `Triage` starts work.
- At start, move the item to `In Progress`.
- Triage may inspect, reproduce, classify impact, identify the likely cause and propose the smallest safe solution.
- If implementation is required after triage, record the findings and place the item in `Ready for Development`. A new agent assignment or explicit invocation is required to start implementation.

### Ready for Development

- `Ready for Development` means the owner has authorized implementation.
- Moving an item there does not start work by itself.
- Assigning or explicitly invoking the FURA Orchestrator starts implementation.
- At start, move the item to `In Progress`.

### Active and final states

- Every item currently being analyzed, implemented, mitigated, tested or documented must be in `In Progress`.
- `Ready for QA` is a waiting queue. When QA begins, move the item back to `In Progress`.
- Use `Monitoring` only when an incident mitigation or production change needs observation before closure.
- Use `Done` only after the required checks pass and the requested outcome is complete.

## Human control

- Do not start normal work from `To Do`.
- Do not treat a status change to `Triage` or `Ready for Development` as sufficient activation without agent assignment or an equivalent explicit instruction.
- Incident mitigation may begin immediately within granted permissions, but destructive, irreversible or high-impact production actions still require explicit authorization.
- Return the item to a waiting status when another owner decision or a separate next-stage activation is required.

## Expected Orchestrator behavior

- Read the issue, label, Project status and relevant repository context before acting.
- Verify that the activation rule is satisfied.
- On activation, publish a compact activity log naming the selected agents, current phase and intended status transition.
- Move the item to `In Progress` before substantive work. If Project fields cannot be edited with available tools, state the required transition explicitly in the issue or PR.
- Select the smallest useful agent set and keep one issue/work item as the source of truth.
- Record each specialist's material result so the owner can see who contributed and how.
- Reject ambiguous or conflicting routing with a concise explanation.
- Return the item to the appropriate waiting status when a genuine product decision, accepted risk or separate implementation activation is required.
