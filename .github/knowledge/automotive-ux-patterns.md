# Automotive UX/UI playbook

Use this playbook for user-facing FURA flows. Combine it with the actual design system and existing component patterns in the repository.

## Experience principles

- Vehicle first: always make the active vehicle and affected record clear.
- Trust before decoration: use provenance, dates, mileage and clear states rather than ornamental gauges.
- Fast capture: common actions should be practical on a phone near a vehicle, workshop or fuel station.
- Progressive detail: show the essential summary first and allow users to open invoices, parts, notes and metadata.
- Honest uncertainty: design explicit states for incomplete, estimated, imported and unverified information.

## Information architecture

- Keep one coherent vehicle timeline as the natural home for service and lifecycle events.
- Distinguish planned/upcoming, attention needed/overdue and completed records.
- Maintain a clear relationship between a reminder and the service event that completes it.
- Support one or several personal vehicles without losing active-vehicle context.
- Use consistent automotive language across navigation, forms and notifications.

## Data-entry patterns

- Optimize date, mileage, liters and price fields for mobile numeric entry.
- Show units next to values and preserve locale-appropriate formatting.
- Validate mileage clearly and explain conflicts without discarding entered data.
- Allow photos/documents to be captured from camera or selected from device when supported.
- Use sensible defaults, but never prefill a value that may silently create a false record.
- For long forms, group related fields and keep optional details visibly optional.

## States and feedback

- Design normal, loading, empty, saved, validation, offline/network failure and permission-denied states when relevant.
- Empty states should explain the value of the first record and provide a clear action.
- Destructive actions involving a vehicle, history or document require consequence-aware confirmation.
- Show whether data was entered by the owner, calculated by FURA or obtained from another source when this affects trust.
- Warnings must state the condition and next action without pretending to diagnose vehicle safety.

## Accessibility and mobile use

- Use adequate touch targets, contrast, readable sizes and keyboard/focus behavior.
- Keep primary actions reachable and avoid dense desktop tables as the only mobile representation.
- Do not encode due/overdue status by color alone.
- Keep critical labels visible; placeholders are not labels.
- Ensure error messages identify the field, problem and corrective action.

## Design-system rule

Apply `reuse > extend > create`:

1. use an existing component and token;
2. extend it when the need is reusable and coherent;
3. create a new component only when a real gap remains.

Automotive character should come from useful vehicle context, hierarchy and trustworthy data—not decorative speedometers, carbon textures, aggressive motion or dashboard gimmicks.

## UX review questions

- Is the active vehicle unambiguous?
- Can the user complete the primary task comfortably on a phone?
- Are units, dates and currency explicit?
- Are incomplete and error states understandable?
- Is the primary action clear without hiding important consequences?
- Does this flow reuse FURA patterns?
- Does the feature strengthen a coherent vehicle history?
