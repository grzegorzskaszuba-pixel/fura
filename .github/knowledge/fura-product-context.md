# FURA product context

This file provides stable product context, not a claim about every currently implemented feature. Verify the repository and live behavior before describing something as available.

## Product purpose

FURA helps a vehicle owner maintain a trustworthy, understandable history of a vehicle and its operating costs. The experience should reduce memory and paperwork burden and make it easy to answer questions such as:

- What was done to this vehicle and when?
- What was the mileage at that time?
- What did it cost?
- What documents or photos support the record?
- What maintenance is approaching?
- What is the total cost of operating the vehicle?

## Primary audience

The default audience is an individual vehicle owner managing one or several personal vehicles. Do not introduce fleet workflows, workshop administration or marketplace behavior unless explicitly approved.

## Known product direction

- user accounts and secure access;
- vehicles owned or managed by a user;
- service-history events;
- mileage and chronological records;
- vehicle-related photos and documents;
- fuel and operating-cost tracking;
- service reminders and notifications;
- email-enabled account and product flows;
- possible future external vehicle-data integrations.

Treat planned items as direction, not implemented functionality.

## Product values

- Trust: dates, mileage, costs and documents must not be presented misleadingly.
- Simplicity: entering a record should be faster than keeping paper notes.
- Continuity: new modules should contribute to one coherent vehicle history.
- Ownership: one user's vehicle data must never be exposed to another user.
- Portability: the history should remain understandable over years and through future product changes.
- Restraint: useful automotive context matters more than decorative dashboard styling.

## Current decision posture

- Mobile-first web experience.
- Reuse established components and patterns.
- Prefer incremental features with clear user value.
- Human approval remains between refinement and implementation.
- Agents may propose but must not silently expand product scope.
