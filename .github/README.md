# FURA GitHub Issue Forms

Ready-to-use GitHub Issue Forms matching the labels already configured in the FURA repository:

- `enhancement` — new feature or request;
- `problem` — something that should work better but is not a confirmed defect;
- `bug` — reproducible behavior that differs from the expected behavior;
- `incident` — an active outage or serious production degradation;
- `enabler` — technical debt, platform work or technical enablement;
- `documentation` — documentation addition or correction.

## Installation

Copy the included `.github` directory to the root of the FURA repository and commit it to the default branch.

```text
FURA repository
└── .github
    └── ISSUE_TEMPLATE
        ├── 01-enhancement.yml
        ├── 02-problem.yml
        ├── 03-bug.yml
        ├── 04-incident.yml
        ├── 05-enabler.yml
        ├── 06-documentation.yml
        └── config.yml
```

After the commit is merged, GitHub displays these choices under **Issues → New issue**. Each form automatically adds its matching existing label.

## Suggested Project routing

Issue Forms assign labels, but this package intentionally does not hard-code a GitHub Project number or Project field values.

Recommended routing:

| Label | Initial Project status | First route after activation |
|---|---|---|
| `enhancement` | Backlog | Orchestrator → Product Manager when moved to Ready for Refinement |
| `problem` | Backlog | Orchestrator → Product Manager/QA when moved to Ready for Refinement |
| `enabler` | Backlog | Orchestrator → Solution Architect when moved to Ready for Refinement |
| `documentation` | Backlog | Orchestrator → Technical Writer when moved to Ready for Refinement |
| `bug` | Ready for Triage | Orchestrator → QA → relevant Developer |
| `incident` | Incident Reported | Orchestrator → Incident Manager immediately |

Project auto-add and status routing can be configured in the next implementation step after confirming the Project owner and number.
