# Automotive product-domain playbook

Use this playbook when refining, designing or reviewing vehicle-owner functionality. It supplies domain heuristics, not legal or manufacturer-specific truth. Verify time-sensitive regulations, maintenance schedules and external-data rules from authoritative sources.

## Core automotive entities

- Vehicle: identity, display name, VIN/registration where appropriate, ownership context and status.
- Odometer reading: value, unit, date, source and confidence.
- Service event: date, mileage, category, work performed, parts, provider, cost, notes and evidence.
- Maintenance reminder: time-based, mileage-based or both; due, upcoming, overdue, completed or dismissed.
- Fuel entry: date, liters, total price, price per unit, mileage, station and notes.
- Expense: category, amount, date, recurrence and related vehicle/event.
- Document/photo: type, related record, capture/upload source, access and lifecycle.

## Product heuristics

### Vehicle history

- History is often incomplete. Clearly distinguish unknown information from zero or "never happened."
- Preserve chronology and original evidence. Corrections should not silently erase meaningful history.
- Mileage usually should not move backwards, but odometer replacement, data import and correction are valid exceptional cases requiring explicit handling.
- A service event may contain several activities and parts but should remain understandable in the main timeline.
- Users think in outcomes such as "oil changed" or "brakes replaced," not internal database entities.

### Maintenance and reminders

- Due logic may depend on date, mileage or whichever occurs first.
- A completed service should close or recalculate the related reminder intentionally.
- Manufacturer intervals differ by vehicle, engine, market and usage; never invent a universal interval.
- "Overdue" is a meaningful warning, not proof that a vehicle is unsafe.

### Fuel and costs

- Distinguish total cost, price per liter and calculated consumption.
- Consumption generally requires consecutive trustworthy odometer readings and appropriate fill-up assumptions.
- Partial fill-ups, missed entries and unit changes can make consumption misleading; explain or exclude them rather than presenting false precision.
- Preserve currency and unit context. Do not combine costs across currencies without an explicit conversion policy.

### Ownership and privacy

- Vehicle identifiers and documents may contain personal data. Collect only what supports a product outcome.
- Every vehicle-scoped operation must verify access/ownership on the server.
- Define behavior for sale, transfer, deletion and account closure before introducing data sharing.
- Uploaded invoices may expose names, addresses, registration numbers and workshop details.

### Product growth

- Favor features that strengthen the coherent vehicle record rather than isolated mini-apps.
- Evaluate integrations by reliability, legal access, coverage, maintenance cost and user value.
- Distinguish owner-entered, calculated and externally sourced data in the UI and data model.
- Do not copy a competitor feature without validating fit with FURA's audience and product direction.

## Refinement questions

For meaningful features, ask or resolve:

1. Which owner problem does this solve?
2. Which vehicle and ownership state does it apply to?
3. What happens when data is missing, late, duplicated or corrected?
4. How does it affect the vehicle timeline?
5. Is the value calculated, entered or externally sourced?
6. What must the user trust, and how is provenance shown?
7. Does it work for multiple personal vehicles?
8. What is the smallest useful version?
9. What should happen after vehicle sale, deletion or account closure?
10. Are privacy, authorization or data-retention decisions involved?

## Avoid

- assuming VIN or external lookup data is always available or accurate;
- treating every warning as safety-critical;
- presenting calculated consumption from insufficient data;
- forcing users to know workshop/engineering terminology;
- designing fleet complexity into personal-owner flows prematurely;
- scattering separate histories across modules instead of maintaining a coherent vehicle timeline.
