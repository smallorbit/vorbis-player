# provider-system Specification

## Purpose

Vorbis Player SHALL support multiple music providers (streaming services, personal file sources, test doubles) behind one provider-neutral contract, so the queue, library, and player UI can mix providers without coupling to any specific source.
## Requirements
### Requirement: Three-Adapter Provider Contract

A provider SHALL be expressed as a bundle of three adapters — auth, catalog, playback — registered as a single descriptor in the provider registry. The registry SHALL enforce this contract at registration time by throwing a typed error when any of the three required adapters is missing or non-object, so a malformed descriptor never enters the registry.

#### Scenario: Provider registered at startup
- **WHEN** the app starts and a provider's module loads
- **THEN** the provider becomes resolvable by id from the registry

#### Scenario: Provider missing a required adapter
- **WHEN** a descriptor is registered without one of the three required adapters
- **THEN** registration throws an `InvalidProviderDescriptorError` naming the provider id and the missing adapter, and the provider is not exposed by the registry

### Requirement: Provider-Neutral Domain Types

All track and collection data exchanged between providers, the queue, the library, and the player UI SHALL use provider-neutral shapes — `MediaTrack`, `MediaCollection`, `CollectionRef`, and `PlaybackState` — so data from any provider is interchangeable.

#### Scenario: Collection reference round-trips through serialization
- **WHEN** a collection reference is serialized to a string and parsed back
- **THEN** the parsed reference equals the original

#### Scenario: Unparseable serialized reference
- **WHEN** an unparseable string is passed to the reference parser
- **THEN** the parser returns a null result rather than throwing

#### Scenario: Track carries a playback reference
- **WHEN** a catalog returns a track
- **THEN** the track carries an opaque playback reference that only its owning provider needs to resolve

### Requirement: Conditional Provider Availability

A provider SHALL be available only when the build-time credentials or feature flags it depends on are set. Providers without their prerequisites SHALL NOT register.

#### Scenario: Provider without credentials at build time
- **WHEN** a provider's required build-time credential is unset
- **THEN** the provider is not registered and not exposed in the UI

#### Scenario: Provider with credentials at build time
- **WHEN** a provider's required build-time credentials are set
- **THEN** the provider registers and becomes resolvable from the registry

### Requirement: Optional Capability Declaration

Each provider SHALL declare which optional behaviors its adapters support. Callers SHALL check a capability before invoking the corresponding optional adapter method.

#### Scenario: Capability declared and supported
- **WHEN** a provider declares an optional capability as supported
- **THEN** callers may invoke the corresponding optional adapter method

#### Scenario: Capability not declared
- **WHEN** a provider does not declare an optional capability
- **THEN** callers SHALL NOT invoke the corresponding optional adapter method

### Requirement: Enabled Provider Set

The app SHALL maintain a persisted set of **enabled** providers representing which providers the user has opted into. The app SHALL never operate with zero enabled providers.

#### Scenario: Enabled set persists across sessions
- **WHEN** the user opts a provider into or out of the enabled set
- **THEN** the change persists across page reloads

#### Scenario: Last enabled provider cannot be removed
- **WHEN** only one provider remains in the enabled set
- **THEN** removing that provider is blocked so the app never reaches a zero-enabled-provider state

