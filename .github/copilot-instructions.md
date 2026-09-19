# FURA repository instructions

FURA is an automotive web application centered on a vehicle owner's service history, maintenance records and operating information. Treat the repository as the source of truth for the currently implemented stack and behavior. Never assume a framework, dependency, endpoint or database schema that has not been verified in the code.

## Product principles

- Optimize for an individual vehicle owner first unless the work item explicitly expands the target audience.
- Keep the vehicle as the primary context for service events, mileage, costs, documents and reminders.
- Preserve chronology and data provenance. Never silently rewrite historical vehicle information.
- Treat mileage, dates, costs and ownership as trust-sensitive data.
- Make incomplete history understandable rather than pretending it is complete.
- Design mobile-first for quick use near the vehicle, at a fuel station or in a workshop.
- Minimize unnecessary personal data and protect uploaded documents and photos.

Use the relevant domain references:

- [FURA product context](knowledge/fura-product-context.md)
- [Automotive product domain](knowledge/automotive-product-domain.md)
- [Automotive UX patterns](knowledge/automotive-ux-patterns.md)
- [GitHub work routing](knowledge/github-workflow.md)

## Engineering principles

- Inspect existing architecture and patterns before editing.
- Prefer the smallest complete change and avoid unrelated refactors.
- Keep business logic separate from UI, transport, persistence and infrastructure.
- Use object-oriented or domain modeling where state and behavior belong together, but do not create classes without a clear responsibility.
- Prefer composition over inheritance and explicit dependencies over hidden global coupling.
- Reuse existing modules before extending them; extend before creating a parallel abstraction.
- Keep controllers, routes, handlers and UI components thin.
- Do not create generic dumping grounds such as `utils`, `helpers`, `manager` or `processor` without a specific domain responsibility.
- Preserve backward compatibility unless a breaking change is explicitly approved.
- Validate untrusted input and enforce authorization and resource ownership server-side.
- Never commit secrets or expose stack traces, tokens, personal data or sensitive document contents.

Follow [the detailed code-quality instructions](instructions/code-quality.instructions.md) for source changes.

## Naming

- Use concise domain names such as `Vehicle`, `ServiceEvent`, `FuelEntry`, `OdometerReading`, `MaintenanceReminder` and `VehicleRepository`.
- Classes and types use nouns; operations use verbs; boolean names start with `is`, `has`, `can` or `should`.
- Avoid vague names and unnecessary abbreviations. Common technical/domain abbreviations such as `id`, `api` and `vin` are acceptable.
- Do not encode an entire implementation description into a class or function name.

## Verification

- Add or update focused tests for changed behavior.
- Run the narrowest relevant checks first and broader checks when risk warrants them.
- Report exactly what was run and never claim a passing result without execution evidence.
- A change is complete only when its acceptance criteria are met, relevant checks pass and no unresolved critical security or data-integrity issue remains.

## Scope and decisions

- Ask the user only when missing information materially changes the outcome, risk or irreversible behavior.
- Record meaningful product decisions in `docs/product/decisions.md` and reusable verified user insights in `docs/product/user-insights.md`.
- Do not add speculative lessons to durable documentation.
