# GitHub work routing

GitHub Issues and Project fields are the shared work queue. A status change is a human approval signal, not merely reporting metadata.

## Labels

| Label | Meaning | Default route |
|---|---|---|
| `enhancement` | New feature or capability | Backlog → Ready for Refinement → Product Manager |
| `problem` | Something should work better, not yet a confirmed defect | Backlog → Ready for Refinement → Product Manager and/or QA |
| `enabler` | Technical debt, architecture, platform or engineering enablement | Backlog → Ready for Refinement → Solution Architect |
| `documentation` | Documentation addition or correction | Backlog → Ready for Refinement → Technical Writer |
| `bug` | Expected behavior is not working | Ready for Triage → QA → relevant Developer |
| `incident` | Active outage, unavailable feature or serious degradation | Incident Reported → Incident Manager immediately |

## Recommended statuses

```text
Backlog
Ready for Refinement
Refinement in Progress
Ready for Your Review
Ready for Implementation
In Progress
Ready for QA
Monitoring
Done
```

## Human gates

- Moving a normal item to `Ready for Refinement` authorizes analysis, not code changes.
- The Orchestrator may update the issue with scope, acceptance criteria, technical/UX/security notes and questions.
- `Ready for Your Review` means refinement is complete and awaiting the user's decision.
- Only `Ready for Implementation` authorizes implementation work.
- Bug triage may inspect and reproduce without separate product refinement.
- Incidents may begin mitigation immediately within granted permissions, but destructive, irreversible or high-impact production actions still require explicit authorization.

## Expected Orchestrator behavior

- Read the issue, label, status and relevant repository context.
- Reject ambiguous or conflicting routing with a concise explanation.
- Select the smallest useful agent set.
- Keep one issue/work item as the source of truth.
- Never convert analysis authorization into implementation authorization.
- Return the item to the user when a genuine product decision or accepted risk is required.
