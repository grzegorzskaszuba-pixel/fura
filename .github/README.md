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

## Project routing

Issue Forms assign labels, but this package intentionally does not hard-code a GitHub Project number or Project field values.

Use these Project statuses:

```text
To Do
Triage
Ready for Development
In Progress
Ready for QA
Monitoring
Done
```

Routing rules:

| Label | Waiting status | Start condition | First route |
|---|---|---|---|
| `enhancement` | To Do | Move to Ready for Development and assign the FURA Orchestrator | Orchestrator → Product Manager as needed → implementation roles |
| `problem` | Triage | Assign the FURA Orchestrator | Orchestrator → Product Manager and/or QA |
| `bug` | Triage | Assign the FURA Orchestrator | Orchestrator → QA → relevant Developer |
| `enabler` | To Do | Move to Ready for Development and assign the FURA Orchestrator | Orchestrator → Solution Architect → relevant Developer |
| `documentation` | To Do | Move to Ready for Development and assign the FURA Orchestrator | Orchestrator → Technical Writer |
| `incident` | To Do | Immediate activation when added to the Project | Orchestrator → Incident Manager immediately |

`To Do` is the passive backlog for every non-incident item. Moving an item to `Triage` or `Ready for Development` does not start work by itself: assigning the FURA Orchestrator is the explicit start signal. The exception is an `incident`, which must be dispatched immediately.

As soon as any agent starts processing an item, its Project status must change to `In Progress`. Project automation for immediate incident dispatch still requires a dispatcher or GitHub workflow; these instructions define the expected behavior but do not create that trigger by themselves.
