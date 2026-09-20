# FURA product decisions

Record only meaningful decisions that future work should reuse. Keep entries concise.

## Entry template

### YYYY-MM-DD — Decision title

- Context:
- Decision:
- Reason:
- Consequences:
- Related issue/PR:

Do not record temporary implementation details or speculative ideas as decisions.

### 2026-09-20 - Registration legal-record semantics

- Context: FURA needs a first GDPR/RODO-aligned registration flow without asking users to re-accept terms at login.
- Decision: Registration requires acceptance of the FURA Terms of Service. The server records the active terms version, server-generated acceptance timestamp, and the privacy policy version presented at registration. The current document version is `2026-09-20`; public links are `/regulamin`, `/polityka-prywatnosci`, `/bezpieczenstwo`, and `mailto:kontakt@fura.info` on `fura.info`.
- Reason: Terms acceptance is distinct from a generic personal-data processing consent, and server-generated evidence cannot be altered by the client.
- Consequences: Existing accounts retain null/unknown legal metadata and continue to log in without a new prompt. Pending email registrations carry the same metadata until activation.
- Related issue/PR: Not provided.
