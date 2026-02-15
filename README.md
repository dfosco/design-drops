# Design Drops

An internal design showcase and collaboration tool. Designers post work to a shared feed backed by GitHub Discussions — no dedicated backend needed.

![Design Drops homepage](docs/screenshot-homepage.png)

## Stack

| Layer | Technology |
|---|---|
| Framework | [Astro](https://astro.build) (static output) |
| Islands | [Svelte 5](https://svelte.dev) |
| UI | [Bits UI](https://bits-ui.com) + [Tailwind CSS v4](https://tailwindcss.com) |
| Language | TypeScript (strict) |
| Data | GitHub Discussions |
| Auth | GitHub PAT (user-provided Personal Access Token) |
| Deploy | GitHub Pages |

## Getting started

```bash
node -v  # requires Node 22+
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321)

### Configuration

Repo and site settings live in [`drops.config.json`](drops.config.json). No environment variables are required — auth is handled via PAT pasted by each user in the browser. To restrict access by email, populate the `access.allowedDomains` and/or `access.allowedEmails` arrays in the config file.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |

## Features

- **Feed** — filterable grid of design posts with search, tag, team, project, and author filters
- **Post creation & editing** — unified composer modal for creating and editing drops with image upload, tags, team/project metadata, and URLs
- **Comments & replies** — threaded comment system on posts
- **Collaborators** — `@tag` GitHub users as collaborators on a post; collaborators can edit and appear in filters
- **User profiles** — per-user page showing their posts and comments
- **Project pages** — per-project page with all entries and collaborators
- **@mentions & \[\[projects\]\]** — autocomplete for mentioning users and linking projects in text fields
- **Soft deletion** — closing a Discussion hides the post from the feed (visible only to authors)
- **Access control** — optionally restrict login to specific email domains and/or an email allowlist via `drops.config.json`
- **Theming** — all design tokens (colors, fonts, spacing, radii) in a single `theme.css` file for easy customization

## Architecture

Users authenticate by pasting a GitHub Personal Access Token (with `repo` + `read:user` scopes) into the app. The token is stored in `localStorage` and used for all reads via GitHub's GraphQL API. Writes (create, edit, delete) are dispatched through the same token.

Posts are stored as GitHub Discussions with structured metadata in `<!-- dd-meta {...} -->` HTML comments. Discussion bodies also contain a human-readable version of the post (title, body, inline images, tags) so content is visible directly on GitHub. Every write is reflected optimistically in `localStorage` while the roundtrip completes in the background.

Client-side routing uses GitHub Pages' 404 fallback — all unknown paths hit `404.astro`, which renders a `PageRouter` Svelte island that routes `/post/`, `/user/`, and `/project/` paths.

See [`plan.md`](plan.md) for the full design document and [`AGENTS.md`](AGENTS.md) for contributor/AI instructions.

## Project layout

```
src/
  components/     # Svelte island components (Feed, PostCard, PostComposer, PostDetail, etc.)
  layouts/        # Astro layouts
  pages/          # Astro pages (index, post, user, project, 404)
  styles/
    global.css    # Base styles
    theme.css     # Design tokens for site-wide theming
  lib/
    api/          # GraphQL client, queries, dispatcher, image handling, user search
    auth/         # PAT-based authentication with optional email access control
    stores/       # Svelte stores (auth, local optimistic state, edit bridge)
    types/        # TypeScript interfaces (PostMetadata, Asset, Comment, etc.)
    config.ts     # Runtime config from drops.config.json
    metadata.ts   # dd-meta parser/serializer
    polling.ts    # localID confirmation polling
    reconcile.ts  # Merge localStorage + API feed data
```

## Versioning

This project uses [Changesets](https://github.com/changesets/changesets) for versioning.

```bash
npx changeset        # create a changeset
npx changeset version  # bump version
```

## License

ISC
