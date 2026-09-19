---
applyTo: "**/*.{js,jsx,ts,tsx,css,scss,html,sql}"
---

# FURA code quality and modular design

Write cohesive, modular code with clear responsibilities. Use object-oriented and domain-oriented design pragmatically, not dogmatically.

## Structure and responsibilities

- Separate business rules from UI, HTTP/transport, persistence and infrastructure concerns.
- Keep routes/controllers/handlers focused on input, orchestration and response mapping.
- Put business behavior in a focused domain object, service or use case.
- Isolate database access in the repository/data-access pattern already used by the codebase.
- Keep React code consistent with the existing style. Prefer functional components and hooks when that is the repository convention; object-oriented design does not require React class components.
- Avoid business logic in visual components, database models, route declarations or generic utility modules.
- Prefer composition over inheritance. Introduce inheritance only for a real stable subtype relationship.
- Inject external dependencies at sensible boundaries when this improves testability; avoid a dependency-injection framework unless the repository already uses one or complexity justifies it.

## Extending existing code

Before adding logic, determine:

1. whether an existing module already owns the responsibility;
2. whether the change extends an existing domain concept;
3. whether a new responsibility deserves a small focused module;
4. whether similar logic already exists;
5. whether a local refactor is needed to avoid another branch in an overloaded function.

Do not append features indefinitely to a large file or function. Refactor the affected seam when necessary, but do not redesign unrelated areas.

## Cohesion and size

- A class, module or function should have one clear reason to change.
- Extract code when it improves ownership, reuse, testability or readability—not merely to reduce line count.
- Avoid god classes, large conditional dispatch blocks and hidden shared mutable state.
- Avoid premature abstractions. Prefer a small amount of clear duplication over the wrong shared abstraction, then consolidate when a stable pattern emerges.

## Naming

- Use the product's ubiquitous language consistently.
- Classes/types/modules: concise nouns that state responsibility.
- Functions/methods: verbs that state observable action.
- Booleans: `is`, `has`, `can` or `should` prefixes.
- Collections use plural nouns; single entities use singular nouns.
- Avoid vague suffixes such as `Manager`, `Helper`, `Processor`, `DataObject`, `Common` and `Utils` unless the name still communicates one precise responsibility.
- Prefer two to four meaningful words over either cryptic abbreviations or sentence-length names.

Good examples:

```text
ServiceEvent
VehicleRepository
CreateFuelEntry
calculateConsumption
hasValidMileage
MaintenanceReminder
```

Poor examples:

```text
Manager
CommonUtils
VehicleServiceHistoryManagementDataProcessingService
handleData
doStuff
```

## Reliability and tests

- Validate inputs at system boundaries and encode important invariants close to the domain behavior.
- Make null/missing/error states explicit.
- Keep time, external APIs, storage and messaging replaceable in tests where practical.
- Add focused tests around business rules, authorization, ownership, calculations and edge cases.
- Do not weaken existing tests to make a change pass unless the expected behavior was deliberately changed.

## Completion check

Before finishing, confirm that:

- new behavior lives in the correct layer;
- naming matches FURA domain language;
- no parallel implementation or unnecessary dependency was introduced;
- the code is testable without booting unrelated parts of the application;
- any necessary local refactor stayed within the task's blast radius.
