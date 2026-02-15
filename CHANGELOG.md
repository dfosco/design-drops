# drops

## 0.6.0

### Minor Changes

- ## v0.6.0 — Theming overhaul, collaborators, reactions, and more

  ### ✨ Features

  - **Collaborators on posts** — posts now support a `collaborators` field in metadata, displayed alongside authors in cards and detail views. Autocomplete search for GitHub users when adding collaborators in the composer.
  - **Reaction picker with state** — emoji reactions on posts and comments now highlight which ones you've already reacted with. Added full `reactionGroups` support to GraphQL queries and mutations.
  - **Project mentions as links** — `[[project]]` syntax in post bodies is now converted to clickable links that navigate to the project profile page.
  - **User profiles** — new `/user/:username` route with avatar, post history, and activity.
  - **Project profiles** — new `/project/:slug` route showing all posts for a project, filterable by tag and team.
  - **Settings page** — new `/settings` route with token management and sign-out.
  - **Dark theme** — full dark mode support via `html.dark` class with theme-aware color tokens. Inline script prevents flash of unstyled content.
  - **Page router** — client-side routing component for SPA-like navigation between feed, post detail, user, project, and settings pages.
  - **Image lightbox** — carousel now supports fullscreen lightbox with keyboard navigation.
  - **Autocomplete textarea** — new reusable textarea component with `@mention` autocomplete for GitHub users.

  ### 🎨 Design & Theming

  - **Normalized theme surface** — consolidated all design tokens into a single `theme.css` file. Raw CSS variables (`--dd-*`) in `:root`/`html.dark` for runtime dark-mode swapping, with a `@theme` block that maps them to Tailwind v4 utilities.
  - **First-class Tailwind color utilities** — migrated ~500 instances of verbose `[var(--color-*)]` syntax to native Tailwind classes (`bg-surface`, `text-text-muted`, `border-border`, etc.) across all 14 components.
  - **Bumped font sizes** — increased `text-xs` (12→13px), `text-sm` (14→15px), and `text-base` (16→17px) for better legibility across the app.
  - **Removed dead theme tokens** — cleaned up ~60 lines of unused `:root` variables (radii, shadows, transitions, spacing, font weights) that were never referenced by any component.
  - **Fixed font-family collision** — renamed `--font-display` to `--font-heading` to avoid collision with the CSS `font-display` property.

  ### 🔧 Refactors

  - **PostComposer as modal** — replaced inline editing in PostDetail with a shared PostComposer modal, reducing code duplication.
  - **Edit store** — new `src/lib/stores/edit.ts` for managing edit state across components.
  - **Theme store** — new `src/lib/stores/theme.ts` for managing light/dark theme preference with localStorage persistence.

  ### 🐛 Fixes

  - **Dark theme rendering** — fixed lightbox z-index, header positioning, and top padding in dark mode.
  - **GraphQL reaction queries** — added `reactionGroups` to `GET_DISCUSSION_BY_NUMBER` query; fixed `users.totalCount` field in reaction group responses.
  - **Auth token URL** — updated PAT generation URL with correct scopes.
  - **Tailwind lint settings** — removed offending entry from VS Code settings.
