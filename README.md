# Design Drops

An internal design showcase and collaboration tool. Designers post work to a shared feed backed by GitHub Discussions — no dedicated backend needed.

![Design Drops homepage](docs/screenshot-homepage.png)

## Stack

| Layer | Technology |
|---|---|
| Framework | [Astro](https://astro.build) (static output) |
| Islands | [Svelte 5](https://svelte.dev) |
| UI | [Bits UI](https://bits-ui.com) + [Tailwind CSS v4](https://tailwindcss.com) |
| Data | GitHub Discussions |
| Auth | GitHub OAuth |
| Write proxy | GitHub Actions |
| Deploy | GitHub Pages |

## Getting started

```bash
node -v  # requires Node 22+
npm install
npm run dev
```

Open [http://localhost:4321/design-drops](http://localhost:4321/design-drops)

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |

## Architecture

All **reads** go directly from the client to GitHub's GraphQL API using the user's OAuth token. All **writes** are proxied through GitHub Actions workflows (because GitHub auto-revokes PATs detected in client-side code).

Posts are stored as GitHub Discussions with structured metadata in `<!-- dd-meta {...} -->` HTML comments. Every write is reflected optimistically in `localStorage` while the roundtrip completes in the background.

See [`plan.md`](plan.md) for the full design document and [`AGENTS.md`](AGENTS.md) for contributor/AI instructions.

## Versioning

This project uses [Changesets](https://github.com/changesets/changesets) for versioning.

```bash
npx changeset        # create a changeset
npx changeset version  # bump version
```

## License

ISC
