## MODIFIED Requirements

### Requirement: Three-Adapter Provider Contract

A provider SHALL be expressed as a bundle of three adapters — auth, catalog, playback — registered as a single descriptor in the provider registry. The registry SHALL enforce this contract at registration time by throwing a typed error when any of the three required adapters is missing or non-object, so a malformed descriptor never enters the registry.

#### Scenario: Provider registered at startup
- **WHEN** the app starts and a provider's module loads
- **THEN** the provider becomes resolvable by id from the registry

#### Scenario: Provider missing a required adapter
- **WHEN** a descriptor is registered without one of the three required adapters
- **THEN** registration throws an `InvalidProviderDescriptorError` naming the provider id and the missing adapter, and the provider is not exposed by the registry
