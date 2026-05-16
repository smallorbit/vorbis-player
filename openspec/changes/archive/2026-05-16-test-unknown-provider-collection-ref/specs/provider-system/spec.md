## No Requirement Changes

No new or modified requirements. The existing provider-system spec's "Unparseable
serialized reference" scenario implicitly covers the unregistered-provider-id case
(a well-formed key referencing a provider not in the registry produces null).

This change adds explicit test coverage for that implicit guarantee only;
no spec-level behavior is added, removed, or modified.
