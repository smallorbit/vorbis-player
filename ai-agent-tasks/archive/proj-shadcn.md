# shadcn/ui Migration Plan for vorbis-player

## Overview
This document outlines a detailed, step-by-step plan for migrating the vorbis-player project to use [shadcn/ui](https://ui.shadcn.com/) components. Each step is broken down for clarity and parallelization, and a full sample issue breakdown is provided for every component in the project.

---

## 1. Project Preparation & Branching
- [ ] Create a new branch: `feat/shadcn-ui-migration`
- [ ] Audit current dependencies for conflicts (Tailwind, Radix, etc.)
- [ ] Document baseline UI/UX for reference (screenshots, user flows)

---

## 2. Install shadcn/ui and Prerequisites
- [ ] Install shadcn/ui CLI and dependencies:
  - [ ] `npx shadcn-ui@latest init`
  - [ ] Install required peer dependencies (Tailwind, Radix, etc.)
- [ ] Run `shadcn-ui init` to scaffold config files
- [ ] Verify/update Tailwind config for shadcn/ui compatibility
- [ ] Update PostCSS, Vite, or TypeScript configs as needed
- [ ] Document any config changes

---

## 3. Set Up Design Tokens & Theming
- [ ] Configure global theme (colors, fonts, spacing) using shadcn/ui tokens
- [ ] Document how to extend/override tokens for custom branding
- [ ] Set up dark/light mode support if needed

---

## 4. Component Migration Epics & Issues

Below are the migration epics and detailed issue breakdowns for each component in the project. Each Epic can be tracked as a parent issue, with subtasks for parallel work.

---

## Epic: Migrate Playlist Component to shadcn/ui

### Subtasks:
- [ ] Audit and analyze Playlist component (`src/components/Playlist.tsx`)
- [ ] Set up shadcn/ui components for Playlist
- [ ] Refactor Playlist layout to shadcn/ui
- [ ] Refactor Playlist items to shadcn/ui
- [ ] Refactor Playlist interactions to shadcn/ui patterns
- [ ] Remove Tailwind from Playlist component
- [ ] Test and validate Playlist component
- [ ] Update Playlist documentation
- [ ] Code review and merge Playlist migration

---

## Epic: Migrate AudioPlayer Component to shadcn/ui

### Subtasks:
- [ ] Audit and analyze AudioPlayer component (`src/components/AudioPlayer.tsx`)
- [ ] Identify all UI elements (controls, progress bar, volume, etc.)
- [ ] Set up shadcn/ui components (Slider, Button, Tooltip, etc.)
- [ ] Refactor layout and controls to shadcn/ui
- [ ] Refactor progress and volume controls to shadcn/ui
- [ ] Refactor any menus or popovers to shadcn/ui
- [ ] Remove Tailwind from AudioPlayer
- [ ] Test and validate AudioPlayer (all controls, accessibility)
- [ ] Update AudioPlayer documentation
- [ ] Code review and merge AudioPlayer migration

---

## Epic: Migrate MediaCollage Component to shadcn/ui

### Subtasks:
- [ ] Audit and analyze MediaCollage component (`src/components/MediaCollage.tsx`)
- [ ] Identify all UI elements (media grid, overlays, etc.)
- [ ] Set up shadcn/ui components (Card, Image, Grid, etc.)
- [ ] Refactor layout and grid to shadcn/ui
- [ ] Refactor overlays and interactions to shadcn/ui
- [ ] Remove Tailwind from MediaCollage
- [ ] Test and validate MediaCollage (layout, accessibility)
- [ ] Update MediaCollage documentation
- [ ] Code review and merge MediaCollage migration

---

## Epic: Migrate hyper-text Component to shadcn/ui

### Subtasks:
- [ ] Audit and analyze hyper-text component (`src/components/hyper-text.tsx`)
- [ ] Identify all UI elements (animated text, links, etc.)
- [ ] Set up shadcn/ui components (Typography, Link, etc.)
- [ ] Refactor text and link elements to shadcn/ui
- [ ] Remove Tailwind from hyper-text
- [ ] Test and validate hyper-text (animation, accessibility)
- [ ] Update hyper-text documentation
- [ ] Code review and merge hyper-text migration

---

## Epic: Migrate AdminKeyCombo Component to shadcn/ui

### Subtasks:
- [ ] Audit and analyze AdminKeyCombo component (`src/components/admin/AdminKeyCombo.tsx`)
- [ ] Identify all UI elements (key combo display, input, etc.)
- [ ] Set up shadcn/ui components (Input, Badge, etc.)
- [ ] Refactor layout and display to shadcn/ui
- [ ] Remove Tailwind from AdminKeyCombo
- [ ] Test and validate AdminKeyCombo (input, accessibility)
- [ ] Update AdminKeyCombo documentation
- [ ] Code review and merge AdminKeyCombo migration

---

## Epic: Migrate VideoAdmin Component to shadcn/ui

### Subtasks:
- [ ] Audit and analyze VideoAdmin component (`src/components/admin/VideoAdmin.tsx`)
- [ ] Identify all UI elements (video list, controls, forms, etc.)
- [ ] Set up shadcn/ui components (List, Card, Button, Input, DropdownMenu, etc.)
- [ ] Refactor layout and controls to shadcn/ui
- [ ] Refactor forms and inputs to shadcn/ui
- [ ] Refactor menus and popovers to shadcn/ui
- [ ] Remove Tailwind from VideoAdmin
- [ ] Test and validate VideoAdmin (all features, accessibility)
- [ ] Update VideoAdmin documentation
- [ ] Code review and merge VideoAdmin migration

---

## Example Issue Titles for Tracker
- `[shadcn/ui] Audit and analyze <Component> component`
- `[shadcn/ui] Set up shadcn/ui components for <Component>`
- `[shadcn/ui] Refactor <Component> layout to shadcn/ui`
- `[shadcn/ui] Refactor <Component> items to shadcn/ui`
- `[shadcn/ui] Refactor <Component> interactions to shadcn/ui patterns`
- `[shadcn/ui] Remove Tailwind from <Component> component`
- `[shadcn/ui] Test and validate <Component> component`
- `[shadcn/ui] Update <Component> documentation`
- `[shadcn/ui] Code review and merge <Component> migration`

---

## Notes
- Repeat the above breakdown for each major component or feature.
- Assign subtasks to different engineers for parallel work.
- Track progress in your project management tool (GitHub Issues, Jira, etc.). 