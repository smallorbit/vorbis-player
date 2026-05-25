# library

## Purpose

The library capability provides the user's primary collection-browsing surface: a multi-section home view of their playlists, albums, liked songs, recently played, and pinned items; a full-text search with persistent filters; a per-collection action menu; and an inline mini-player for continuing playback without leaving the view.

## Requirements

### Requirement: Home view section order

The home view SHALL present sections in a fixed top-to-bottom order: Resume, Recently Played, Pinned, Playlists, Albums. Any section with no items and no pending load SHALL be hidden. The Resume section SHALL additionally be hidden when no resumable session exists.

#### Scenario: All sections have content

- **WHEN** all sections have at least one item and a resumable session exists
- **THEN** all five sections appear in order: Resume, Recently Played, Pinned, Playlists, Albums

#### Scenario: Section is empty after loading completes

- **WHEN** a section finishes loading and has zero items
- **THEN** that section is not rendered

#### Scenario: Resume section with no last session

- **WHEN** no session snapshot is provided or the session is stale
- **THEN** the Resume section is not rendered

### Requirement: Pinned section item ordering

The Pinned section SHALL list Liked Songs entries before user-pinned playlists, and user-pinned playlists before user-pinned albums.

#### Scenario: Unified liked songs with user-pinned items

- **WHEN** liked songs are unified across providers and there are also pinned playlists and albums
- **THEN** the single Liked Songs entry appears first, followed by pinned playlists, then pinned albums

#### Scenario: Multi-provider liked songs, not unified

- **WHEN** the user has liked songs on multiple providers and unified mode is not active
- **THEN** one Liked Songs entry per provider appears at the top of the Pinned section, each showing a per-provider song count

#### Scenario: Liked songs count subtitle grammar

- **WHEN** the liked songs count is exactly 1
- **THEN** the subtitle reads "1 song"
- **WHEN** the count is any other number
- **THEN** the subtitle reads "`<n>` songs"

#### Scenario: Pinned id not in loaded library

- **WHEN** a pinned collection id does not match any item in the synced library
- **THEN** that id is silently omitted from the Pinned section

### Requirement: See All navigation

In row (mobile) layout, sections with item counts above their threshold SHALL display a "See all" button. Activating "See all" SHALL navigate to the SeeAll view for that section. In SeeAll view the user SHALL be able to return to the home view. The SeeAll view SHALL always use grid layout regardless of the host device layout.

#### Scenario: Playlist section exceeds threshold in row layout

- **WHEN** the Playlists section contains more than 8 items and the layout is row
- **THEN** a "See all" control is shown for Playlists

#### Scenario: Playlist section at or below threshold in row layout

- **WHEN** the Playlists section contains 8 or fewer items
- **THEN** no "See all" control is shown for Playlists

#### Scenario: Album section threshold

- **WHEN** the Albums section contains more than 8 items and the layout is row
- **THEN** a "See all" control is shown for Albums

#### Scenario: Pinned section threshold

- **WHEN** the Pinned section contains more than 6 items and the layout is row
- **THEN** a "See all" control is shown for Pinned

#### Scenario: Recently Played section threshold

- **WHEN** the Recently Played section contains more than 4 items and the layout is row
- **THEN** a "See all" control is shown for Recently Played

#### Scenario: See all not shown in grid layout

- **WHEN** the layout is grid (desktop)
- **THEN** no "See all" control is shown for any section regardless of item count

#### Scenario: Back from SeeAll view

- **WHEN** the user activates the back control in SeeAll view
- **THEN** the view returns to the home view

### Requirement: Search query routing

Entering a non-empty search query SHALL replace the home (or SeeAll) view with a search results view. Clearing the query SHALL restore the previous non-search view.

#### Scenario: Non-empty query entered

- **WHEN** the user types a non-empty string into the search input
- **THEN** the search results view replaces any currently displayed home or SeeAll view

#### Scenario: Query cleared

- **WHEN** the search input is cleared to empty
- **THEN** the home view is restored

#### Scenario: Initial search query seed

- **WHEN** the library is opened with a pre-supplied query string
- **THEN** the search input is pre-populated with that string and the search results view is displayed immediately

### Requirement: Search text matching

The search capability SHALL match items case-insensitively on collection name. For albums, it SHALL also match on artist names. An empty (or whitespace-only) query SHALL match all items.

#### Scenario: Case-insensitive name match

- **WHEN** the normalized query is a substring of the collection name (case-insensitive)
- **THEN** the item appears in results

#### Scenario: Artist name match for albums

- **WHEN** the normalized query matches the album's artist string (case-insensitive)
- **THEN** the album appears in results even if its title does not match

#### Scenario: Empty query matches everything

- **WHEN** the query is empty or contains only whitespace
- **THEN** all items pass the text match check

#### Scenario: No match

- **WHEN** neither name nor artist contains the query
- **THEN** the item is excluded from results

#### Scenario: No results message

- **WHEN** all filter and text criteria yield zero matching items
- **THEN** a "No results" message is shown instead of empty sections

### Requirement: Search filter persistence

Provider filter, kind filter, and sort preference SHALL be persisted across sessions in local storage using fixed keys. Filter and sort state SHALL survive closing and reopening the library.

#### Scenario: Provider filter toggles

- **WHEN** the user toggles a provider in the filter sheet
- **THEN** that provider is added to or removed from the active provider filter
- **AND** only items from selected providers appear in search results

#### Scenario: Kind filter restricts collection types

- **WHEN** the user selects only "playlist" in the kind filter
- **THEN** album items are excluded from search results

#### Scenario: Sort order applied

- **WHEN** the sort is set to "A → Z"
- **THEN** results within a section are ordered alphabetically ascending by name using locale-aware comparison

#### Scenario: Sort order name-desc

- **WHEN** the sort is set to "Z → A"
- **THEN** results within a section are ordered alphabetically descending

#### Scenario: Sort order recent

- **WHEN** the sort is set to "Recently Added" (the default)
- **THEN** item order within sections is unchanged (provider-supplied order)

#### Scenario: Filter state active indicator

- **WHEN** any filter (provider, kind, or sort) differs from its default
- **THEN** the filter button is visually marked as having active filters

#### Scenario: Clear all resets all state

- **WHEN** the user activates "Clear all"
- **THEN** the query is cleared, all provider and kind filters are removed, and the sort is reset to "Recently Added"

#### Scenario: Provider filter hidden for single provider

- **WHEN** exactly one provider is connected
- **THEN** the source filter group is not shown in the filter sheet

### Requirement: Collection context menu

Each collection card SHALL support a context menu accessible via right-click (pointer) or long press (touch). The menu SHALL present actions appropriate to the collection kind. Keyboard users SHALL be able to navigate menu items with arrow keys and dismiss with Escape.

#### Scenario: Context menu opens on right-click

- **WHEN** the user right-clicks a library card
- **THEN** the context menu opens anchored near the pointer position

#### Scenario: Context menu opens on long press

- **WHEN** the user long-presses a library card on a touch device
- **THEN** the context menu opens

#### Scenario: Playlist menu items

- **WHEN** the context menu is opened for a playlist collection
- **THEN** the menu contains: Play, Add to Queue, Play Next, Pin/Unpin, Start Radio

#### Scenario: Album menu items

- **WHEN** the context menu is opened for an album collection
- **THEN** the menu contains: Play, Add to Queue, Play Next, Pin/Unpin, Unlike, Start Radio

#### Scenario: Liked Songs menu items

- **WHEN** the context menu is opened for a Liked Songs collection
- **THEN** the menu contains a "Play All" item plus one "Play (Provider)" item per connected provider

#### Scenario: Recently-played appends Remove from history

- **WHEN** the context menu is opened from the Recently Played section
- **THEN** a "Remove from history" item (destructive) is appended after the kind-specific items

#### Scenario: Pin/Unpin label reflects current state

- **WHEN** the collection is already pinned
- **THEN** the menu item label is "Unpin"
- **WHEN** the collection is not pinned
- **THEN** the menu item label is "Pin"

#### Scenario: Start Radio disabled when unavailable

- **WHEN** radio generation is not available (e.g. Last.fm key absent)
- **THEN** the Start Radio item is rendered disabled

#### Scenario: Play Next disabled when unavailable

- **WHEN** the play-next action is not available
- **THEN** the Play Next item is rendered disabled

#### Scenario: Queue Liked Songs optional item

- **WHEN** the queue-liked-tracks action is available for a playlist or album
- **THEN** a "Queue Liked Songs" item is included in the menu

#### Scenario: Arrow key navigation in menu

- **WHEN** the context menu is open and the user presses Arrow Down
- **THEN** focus moves to the next enabled menu item (wrapping to first)
- **WHEN** the user presses Arrow Up
- **THEN** focus moves to the previous enabled menu item (wrapping to last)

#### Scenario: Escape dismisses menu and returns focus

- **WHEN** the context menu is open and the user presses Escape
- **THEN** the menu closes and focus returns to the card that triggered it

#### Scenario: Action error shown as toast

- **WHEN** a menu action fails
- **THEN** a toast message describing the failure is shown to the user

### Requirement: Provider badge display

When multiple providers are connected, collection cards SHALL display a provider badge so the user can identify which service a collection belongs to.

#### Scenario: Multiple providers connected

- **WHEN** two or more providers are active
- **THEN** each collection card shows a small badge identifying its provider

#### Scenario: Single provider connected

- **WHEN** only one provider is active
- **THEN** no provider badge is shown on collection cards

### Requirement: Mini-player during library browsing

While the library is visible and a track is currently loaded, a compact mini-player SHALL be shown. The mini-player SHALL display the track name, artist, and artwork. Tapping the mini-player expand area SHALL navigate to the full player. When no track is loaded, the mini-player SHALL not be shown.

#### Scenario: Mini-player visible with active track

- **WHEN** a track is currently loaded and the library is open
- **THEN** the mini-player is visible with the track name and artist

#### Scenario: Mini-player hidden with no active track

- **WHEN** no track is currently loaded
- **THEN** the mini-player is not rendered

#### Scenario: Expand tap navigates to full player

- **WHEN** the user taps the mini-player expand area
- **THEN** the library closes and the full player is shown

### Requirement: Escape key dismissal

The library SHALL close when the user presses Escape, provided focus is not inside a text input or content-editable element.

#### Scenario: Escape outside input closes library

- **WHEN** the user presses Escape and focus is not in an input, textarea, or content-editable element
- **THEN** the library close callback is invoked

#### Scenario: Escape inside input does not close library

- **WHEN** the user presses Escape while focus is inside the search input
- **THEN** the library close callback is not invoked

#### Scenario: No close callback provided

- **WHEN** no close callback is wired
- **THEN** pressing Escape has no effect and produces no error

### Requirement: Responsive layout

On mobile viewports the library SHALL use a row card layout and position the search bar below the section content. On desktop viewports it SHALL use a grid card layout and position the search bar above the section content.

#### Scenario: Mobile layout

- **WHEN** the viewport is classified as mobile
- **THEN** cards are rendered in row layout and the search bar is positioned at the bottom

#### Scenario: Desktop layout

- **WHEN** the viewport is classified as desktop
- **THEN** cards are rendered in grid layout and the search bar is positioned above the content area
