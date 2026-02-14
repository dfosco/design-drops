# AGENTS.md — Design Drops

## What This Is

Design Drops is an internal design showcase tool backed by GitHub Discussions. Designers post work to a shared feed; GitHub Discussions is the database, GitHub Actions is the write proxy, and the frontend is the only user-facing surface.

## Architecture

**Read/write split:** All reads go directly from the client to GitHub's GraphQL API using the user's OAuth token. All writes are proxied through GitHub Actions workflows because GitHub auto-revokes PATs detected in client-side code.

**Two tokens:**
- `ACTIONS_TOKEN` (client-side) — weak `actions:write` scope, can only trigger `workflow_dispatch`
- `DESIGN_DROPS_PAT` (repo secret) — full Discussion read/write, used server-side inside workflow runs only

**Two workflows:**
- `full_workflow.yml` — used when images need uploading to GitHub CDN first
- `lean_workflow.yml` — text-only mutations (create, edit, delete) via GraphQL

**Optimistic state:** Every write is reflected immediately in `localStorage` with a `localID`. A polling loop (3s interval, 30s timeout) searches Discussion bodies for the matching `localID` to confirm the roundtrip. The feed merges localStorage entries with API results.

## Stack

| Layer | Technology |
|---|---|
| Framework | Astro (static output) |
| Islands | Svelte 5 |
| UI | Bits UI + Tailwind CSS v4 (via `@tailwindcss/vite` plugin) |
| Language | TypeScript (strict) |
| Data | GitHub Discussions — metadata stored in `<!-- dd-meta {...} -->` HTML comments in Discussion bodies |
| Deploy | GitHub Pages (default), adaptable to Vercel/Netlify/Cloudflare |

## Key Conventions

### Post metadata format

Every Discussion body contains a `<!-- dd-meta { ... } -->` HTML comment block with structured JSON. This is the source of truth for post metadata (title, authors, tags, assets, pins). The `parseMetadata()` and `serializeMetadata()` functions in `src/lib/metadata.ts` handle this — never parse it manually.

### Optimistic entry lifecycle

localStorage entries carry a `status` field: `pending` → `syncing` → `synced`. Also `pendingDeletion`, `pendingEdit`, `failed`. Always update status through the store helpers in `src/lib/stores/local.ts`.

### Workflow selection

Choose `full_workflow` when `pendingImages` array is non-empty, `lean_workflow` otherwise. The dispatcher in `src/lib/api/dispatch.ts` handles this — call it rather than hitting the GitHub API directly.

### Soft deletion

Posts are never hard-deleted. Deletion closes the Discussion. Closed Discussions are only shown to users in the post's `authors` array (client-side filtering).

### Svelte islands in Astro

Interactive components are Svelte files in `src/components/` rendered as Astro islands with `client:load` or `client:idle`. Non-interactive layout stays in `.astro` files.

## Project Layout

```
src/
  components/    # Svelte island components
  lib/
    api/         # GraphQL client, queries, workflow dispatcher
    stores/      # Svelte stores (auth, local optimistic state)
    types/       # TypeScript interfaces (PostMetadata, Asset, etc.)
    metadata.ts  # dd-meta parser/serializer
    polling.ts   # localID confirmation polling
    reconcile.ts # Merge localStorage + API feed data
  layouts/       # Astro layouts
  pages/         # Astro pages
  styles/        # Global CSS (Tailwind)
.github/
  workflows/     # deploy.yml, lean_workflow.yml, full_workflow.yml
```
