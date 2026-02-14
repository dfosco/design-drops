# Design Drops
### Conceptual & Technical Planning Document — v1.0

---

## 1. Product Overview

Design Drops is an internal design showcase and collaboration tool that allows a team of designers to post their work to a shared feed. It is purpose-built for designers — visually polished, fast, and contextual — while using GitHub Discussions as its persistence layer, requiring no dedicated backend infrastructure.

### 1.1 Core Concept

The product inverts the typical relationship between a custom tool and its database. Rather than building a backend that syncs to GitHub, Design Drops treats GitHub Discussions as a managed, structured database. The GitHub web interface is irrelevant to end users — Design Drops is the only surface that matters, and it owns the entire presentation layer.

**What designers see**
- A beautiful, fast internal feed of design work
- Rich posts with image carousels and metadata
- Figma-style contextual comment pins on images
- Threaded comments and sub-comments
- Instant optimistic updates — no perceived latency

**What powers it**
- GitHub Discussions as the data store
- GitHub OAuth for user identity
- GitHub Actions as the write proxy
- GitHub CDN for image hosting
- localStorage for optimistic state

---

## 2. Architecture

### 2.1 Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend Framework | Astro | Partial hydration, performance-first for feed rendering |
| UI / Design System | Reshaped | No styled-components dependency; works with Astro; polished enough for a design audience |
| Data Store | GitHub Discussions | Free, managed, structured — no backend database needed |
| Auth | GitHub OAuth | Identity capture only; no elevated org permissions required |
| Read API | GitHub GraphQL API | Rich Discussion queries; called client-side with OAuth token |
| Write Proxy | GitHub Actions | PAT stays in repo secrets; client only holds a weak `actions:write` token |
| Image Hosting | GitHub CDN | Undocumented but stable upload endpoint; images served from `user-images.githubusercontent.com` |
| Optimistic State | localStorage | Instant perceived performance; cache-invalidated on API confirmation |

### 2.2 Security Model

The security architecture is built around one hard constraint: **GitHub automatically revokes any PAT it detects in client-side code.** Two tokens with different permission scopes handle the separation of concerns.

**Client-side token (`actions:write` scope)**
- Held in the frontend environment
- Only permission: trigger `workflow_dispatch`
- If leaked: attacker can only trigger workflows
- Acceptable exposure risk for an internal tool

**PAT (repo secret)**
- Never leaves GitHub infrastructure
- Full Discussion read/write + image upload permissions
- Lives in GitHub Actions repo secrets only
- Executed server-side inside workflow runs

> ⚠️ **Why not expose the PAT client-side?** GitHub actively scans public and private repositories, network traffic, and known token patterns. Any detected PAT is automatically revoked. All write operations must therefore be proxied through GitHub Actions.

### 2.3 Read vs Write Split

All **reads** go directly from the client to GitHub's GraphQL API, authenticated with the user's OAuth token. Fast, no Actions involvement, OAuth read scope is sufficient.

All **writes** — Discussion creation, updates, deletions, and image uploads — are routed through GitHub Actions workflows. The PAT executes these server-side.

```js
// READ — direct from client, authenticated via OAuth token
const { data } = await graphqlClient.query({
  query: GET_DISCUSSIONS,
  variables: { categoryId, first: 20 }
});

// WRITE — trigger workflow_dispatch with weak actions:write token
await fetch('https://api.github.com/repos/{org}/{repo}/actions/workflows/{id}/dispatches', {
  method: 'POST',
  headers: { Authorization: `Bearer ${ACTIONS_TOKEN}` },
  body: JSON.stringify({
    ref: 'main',
    inputs: { payload: JSON.stringify(mutationPayload) }
  })
});
```

---

## 3. Data Model

### 3.1 GitHub Discussions Mapping

| Design Drops Concept | GitHub Primitive | Notes |
|---|---|---|
| Post | Discussion | One Discussion per post; body = prose + metadata block |
| Comment | Discussion Comment | Top-level reply to the Discussion |
| Sub-comment | Comment Reply | Nested reply within a Discussion Comment thread |
| Deleted Post | Closed Discussion | Soft delete via close; data preserved |
| Post Edit | Discussion body patch | Workflow updates Discussion body in place |

### 3.2 Post Metadata Schema

Every Discussion body contains a structured metadata block alongside the prose body text. This block is the canonical source of truth for all Design Drops-specific data. GitHub renders it as an HTML comment (invisible to GitHub readers); the Design Drops frontend parses it on every read.

```
<!-- dd-meta
{
  "localID": "a3f8c1b2-9e4d-4f7a-b2c1-d8e9f0a1b2c3",
  "versionID": "v_1707823445123",
  "authors": ["mia", "jake"],
  "title": "New onboarding flow — mobile",
  "tags": ["mobile", "onboarding", "v2"],
  "team": "Growth",
  "project": "Onboarding Redesign",
  "urls": [
    "https://figma.com/proto/abc123",
    "https://staging.example.com/onboarding"
  ],
  "assets": [
    {
      "id": "img-1",
      "type": "image",
      "url": "https://user-images.githubusercontent.com/org/abc123.png",
      "pendingCDN": false
    },
    {
      "id": "img-2",
      "type": "image",
      "url": "https://user-images.githubusercontent.com/org/def456.png",
      "pendingCDN": false
    }
  ],
  "commentPins": [
    {
      "commentLocalID": "b1c2d3e4-...",
      "imageID": "img-1",
      "x": 0.42,
      "y": 0.31
    }
  ]
}
-->
```

### 3.3 Metadata Field Reference

| Field | Type | Description |
|---|---|---|
| `localID` | UUID string | Client-generated ID. Written into Discussion metadata. Used to match optimistic localStorage entries to real Discussions during polling. |
| `versionID` | string (timestamp) | Used for cache invalidation. Updated on every edit. Client compares stored versionID against fetched versionID to detect stale state. |
| `authors` | string[] | Array of GitHub usernames captured at post time via OAuth. A closed (deleted) Discussion is shown only to users whose username appears in this array. |
| `title` | string | Display title of the post. Separate from the GitHub Discussion title, which is auto-generated. |
| `tags` | string[] | Free-form tags. Used for filtering. Will be aggregated into an index in a future release. |
| `team` | string | Team name. Free-form. Used for filtering and grouping. |
| `project` | string | Project name. Free-form. Enables project-scoped views. |
| `urls` | string[] | External URLs (Figma prototypes, staging links, etc.) displayed as link cards on the post. |
| `assets` | Asset[] | Ordered array of image assets. Each has an `id` (for pin anchoring), `type`, `url` (CDN), and a `pendingCDN` flag set to `true` while upload is in flight. |
| `commentPins` | Pin[] | Array of pin objects linking a comment's `localID` to an image asset and relative x/y coordinates (0–1 range, resolution-independent). |

---

## 4. Optimistic State & Cache Invalidation

### 4.1 Overview

Because all writes are proxied through GitHub Actions, there is an inherent latency between a user submitting a post and the Discussion existing in the API. To eliminate perceived latency, every write operation is reflected immediately in localStorage as an optimistic entry, and the UI renders from this local state while the roundtrip completes in the background.

### 4.2 Entry Lifecycle

Every localStorage entry carries a `status` field that tracks its lifecycle:

| Status | Meaning |
|---|---|
| `pending` | Workflow has been dispatched. Discussion does not yet exist in the API. UI shows the post optimistically. |
| `syncing` | Polling has begun. The client is searching Discussion bodies for a matching `localID`. Continues for up to 30 seconds. |
| `synced` | `localID` found in API. Discussion ID confirmed. localStorage entry replaced with canonical API data. |
| `pendingDeletion` | User deleted the post. If a Discussion ID is already known, fire delete immediately. If still pending/syncing, flag for deletion on first API match. |
| `pendingEdit` | User edited the post. Workflow will patch the Discussion body. UI renders the edited version optimistically. |
| `failed` | Polling timed out (30s) with no match, or an explicit error file was found at `uploads/{localID}.error`. User is shown a retry option. |

### 4.3 Invalidation Logic

The client polls for the `localID` match every 3 seconds, timing out at 30 seconds. On each feed refresh, a reconciliation pass compares all `synced` localStorage entries against the current API results. Any entry whose `discussionID` is absent from the API response is silently cleared — this handles remote deletions that occurred after the local entry was confirmed.

```js
async function pollForConfirmation(localID, timeoutMs = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const discussion = await findDiscussionByLocalID(localID);

    if (discussion) {
      const localEntry = getLocalEntry(localID);
      if (localEntry.status === 'pendingDeletion') {
        await dispatchDeleteWorkflow(discussion.id);
        clearLocalEntry(localID);
        return;
      }
      replaceWithCanonical(localID, discussion);
      return;
    }

    const errorExists = await checkErrorFile(localID);
    if (errorExists) {
      setLocalStatus(localID, 'failed');
      return;
    }

    await sleep(3000);
  }

  setLocalStatus(localID, 'failed');
}
```

### 4.4 Image Upload & Optimistic Preview

When a post includes images, the `full_workflow` must upload them to the CDN before the Discussion can be created (since the CDN URLs must be baked into the metadata). During this time:

- The localStorage entry holds a base64 preview of each image for immediate display
- The carousel renders the local preview while `pendingCDN: true`
- When the Discussion is confirmed and the CDN URLs are resolved, the canonical data replaces the local entry and the real CDN-hosted images load in seamlessly

The Discussion body is only written once — complete, with real CDN URLs already in place. There is no patching step.

---

## 5. GitHub Actions Workflows

### 5.1 Workflow Selection

The client selects which workflow to dispatch based on whether new images need to be uploaded. This avoids the Actions cold start cost for simple text operations.

**`full_workflow`** — triggered when `pendingImages` array is non-empty
- Step 1: Upload all images to GitHub CDN
- Step 2: Populate `assets` array with CDN URLs
- Step 3: Write Discussion with complete metadata baked in
- Step 4: On failure, write `uploads/{localID}.error` to repo
- Expected duration: 20–60s (Actions cold start + upload)

**`lean_workflow`** — triggered when no new images are pending
- Goes straight to GraphQL mutation with PAT
- Text-only posts, edits with no new images, deletions, comments without images
- Expected duration: 5–15s (cold start only)

### 5.2 Image Upload Flow

GitHub hosts images uploaded through an undocumented endpoint used internally by their own editor (`POST https://github.com/upload/policies/assets`). This endpoint is stable in practice — GitHub cannot break its own editor — and produces permanent CDN URLs at `user-images.githubusercontent.com`. The PAT authenticates the upload inside the workflow, where it is safe.

```yaml
# full_workflow.yml (simplified)
name: Design Drops — Full Workflow
on:
  workflow_dispatch:
    inputs:
      payload:
        description: 'JSON payload from client'
        required: true

jobs:
  create-post:
    runs-on: ubuntu-latest
    steps:
      - name: Upload images to GitHub CDN
        env:
          GH_PAT: ${{ secrets.DESIGN_DROPS_PAT }}
        run: |
          # Decode base64 images from payload
          # POST each to GitHub's upload endpoint with PAT auth
          # Collect CDN URLs into assets array

      - name: Create GitHub Discussion
        env:
          GH_PAT: ${{ secrets.DESIGN_DROPS_PAT }}
        run: |
          # Build complete metadata block with CDN URLs
          # POST to GraphQL createDiscussion mutation

      - name: Write error signal on failure
        if: failure()
        run: |
          echo '{"error": true}' > uploads/$LOCAL_ID.error
          git add . && git commit -m "dd: error signal" && git push
```

### 5.3 Mutation Operations

| Operation | Workflow | Notes |
|---|---|---|
| Create post (with images) | `full_workflow` | Uploads images, bakes CDN URLs into metadata, creates Discussion |
| Create post (text only) | `lean_workflow` | Direct GraphQL `createDiscussion` mutation |
| Edit post (new images) | `full_workflow` | Uploads new images, patches Discussion body with updated metadata |
| Edit post (no new images) | `lean_workflow` | Patches Discussion body with updated metadata only |
| Delete post | `lean_workflow` | Closes the Discussion (soft delete) |
| Create comment (with image) | `full_workflow` | Uploads image, creates Discussion comment with CDN URL |
| Create comment (text only) | `lean_workflow` | Direct GraphQL `addDiscussionComment` mutation |
| Delete comment | `lean_workflow` | Minimizes or deletes Discussion comment |

---

## 6. Comments, Sub-comments & Contextual Pins

### 6.1 Comment Structure

Comments follow the same optimistic pattern as posts, with identical lifecycle states and `localID`-based invalidation. The same workflow routing applies — text-only comments use the lean workflow for speed; image-bearing comments use the full workflow.

### 6.2 Contextual Pins (Figma-style)

Comment threads can be anchored to specific coordinates on an image within a post's carousel. Pins are stored in the **post's metadata** (not the comment's), maintaining the post as the single source of truth for all spatial data.

**Coordinate system:** Pin positions are stored as relative coordinates in the range `0.0–1.0` on both axes, independent of display resolution. `x: 0.0` is the left edge, `x: 1.0` is the right edge. The frontend maps these to pixel positions at render time.

```js
// Pin object stored in post metadata
{
  "commentLocalID": "b1c2d3e4-f5a6-7890-abcd-ef1234567890",
  "imageID": "img-1",   // references asset.id in the same metadata block
  "x": 0.42,            // 42% from left edge
  "y": 0.31             // 31% from top edge
}

// Frontend rendering
function renderPin(pin, imageElement) {
  const { width, height } = imageElement.getBoundingClientRect();
  return {
    left: pin.x * width,
    top: pin.y * height,
  };
}
```

Pin visibility: all pins are always visible in v1 (no resolved/unresolved state). Clicking a pin opens its associated comment thread. Pins are rendered per-image — switching carousel slides shows only the pins anchored to the active image.

---

## 7. Deletion & Failure Handling

### 7.1 Soft Deletion

Posts are never hard-deleted from GitHub. A deletion closes the Discussion, preserving the data. The client filters closed Discussions based on authorship: a closed Discussion is only shown to users whose OAuth-authenticated username appears in the post's `authors` array.

> 🔒 **Security note:** This is client-side filtering only. A user with a valid OAuth token could query the GitHub GraphQL API directly and see closed Discussions. This is an acceptable tradeoff for an internal team tool. True access control would require a backend-enforced permission layer.

### 7.2 Race Condition: Delete Before Roundtrip

If a user deletes a post while its Discussion is still being created (`status: pending` or `syncing`), the client sets the localStorage entry to `pendingDeletion` rather than removing it. When the polling loop finds the Discussion, it detects the flag and dispatches a delete workflow instead of swapping in the canonical data.

```js
function handleDelete(localID) {
  const entry = getLocalEntry(localID);

  if (entry.status === 'synced' && entry.discussionID) {
    // Discussion exists — fire delete immediately
    dispatchWorkflow('lean_workflow', { action: 'delete', discussionID: entry.discussionID });
    clearLocalEntry(localID);
  } else {
    // Still in flight — mark for deletion, polling loop handles it
    setLocalStatus(localID, 'pendingDeletion');
  }
}
```

### 7.3 Remote Deletion Reconciliation

On every feed refresh, the client compares all `synced` localStorage entries against the API results. Any synced entry whose `discussionID` does not appear in the current API response is silently cleared. This handles cases where a Discussion was deleted directly on GitHub after the local entry was already confirmed.

### 7.4 Failure Modes

| Failure Mode | Detection | Resolution |
|---|---|---|
| Network failure — payload never sent | `workflow_dispatch` fetch throws | Entry stays `pending`; show retry button; same `localID` reused on retry to prevent duplication |
| Workflow dispatch accepted but job fails internally | Workflow writes `{localID}.error` file to repo; client detects on next poll | Status set to `failed`; show retry; error file cleaned up on next attempt |
| Partial failure — Discussion created but metadata malformed | 30s timeout with no `localID` match | Status set to `failed`; orphaned Discussion remains on GitHub (acceptable for internal tool); retry creates a new Discussion |
| GitHub search lag — Discussion exists but not yet indexed | Poll continues beyond expected time | 30s grace window accommodates indexing lag; entry stays `syncing` until match or timeout |

---

## 8. Product Features (v1 Scope)

### 8.1 Post Composition

- Title, body text, tags, team, project, external URLs
- Multiple image uploads per post (carousel display)
- Images uploaded to GitHub CDN via `full_workflow`; base64 preview shown optimistically during upload
- Assets rendered in an ordered carousel; order defined by the `assets` array in metadata
- External URLs displayed as link cards beneath the carousel
- Multiple authors supported per post

### 8.2 Feed

- Chronological feed of open Discussions
- Closed Discussions visible only to users listed in `authors`
- Renders from a mix of localStorage (optimistic) and API (canonical) data
- Reconciliation on every refresh clears orphaned local entries

### 8.3 Comments

- Top-level comments map to Discussion Comments
- Sub-comments (replies) map to Comment Replies
- Same optimistic pattern as posts: instant local render, background API confirmation
- Text-only comments use `lean_workflow`; image comments use `full_workflow`
- Contextual pins anchored to specific image coordinates; stored in post metadata
- All pins always visible (no resolve state in v1)

### 8.4 Identity & Auth

- GitHub OAuth login required to post or comment
- OAuth token used for all read operations (GraphQL)
- Username and avatar captured at login; embedded in post/comment metadata
- No elevated org permissions required — standard user OAuth scopes only
- A single bot account (with PAT in repo secrets) executes all writes via Actions; GitHub attribution is irrelevant since Design Drops is the only UI

---

## 9. Deferred to Future Releases

| Feature | Notes |
|---|---|
| Search indexes | Periodic GitHub Actions cron job aggregates tags, projects, and teams into repo index files (`indexes/tags.json` etc.) for faster filter queries. Deferred due to read/write source-of-truth complexity in v1. |
| Comment resolution | Pins and threads can be marked resolved, hiding the pin from the image. Requires a `resolved` flag in pin metadata and a UI toggle. |
| Image versioning | When a post image is replaced, existing comment pins reference stale coordinates. Requires a versioned asset model. |
| Prototype embeds | Most prototype tools (Figma, Framer) block iframe embedding via CSP headers. Deferred; prototype URLs are displayed as link cards in v1. |
| Reactions / likes | GitHub Discussion reactions could be surfaced as emoji reactions on posts. |
| Notifications | GitHub Discussion notification subscriptions could power in-app or email alerts for comments on a designer's post. |

---

## 10. Open Questions

- **Discussion category:** What GitHub Discussion category should posts live in? A dedicated "Design Drops" category should be created in the target repo to keep posts isolated from other Discussion activity.

- **Tab-closed mid-flight:** What happens to the `localID` polling if the browser tab is closed? The entry will be in `pending` or `syncing` state on next load. The app should resume polling on mount for any non-terminal entries.

- **Pin storage location:** Comment pins are currently stored in post metadata, making the post the single source of spatial truth. This means editing a comment does not require patching the post — confirmed as the right call.

- **GraphQL payload limits:** Base64 images should never be sent via GraphQL — only CDN URLs. The `pendingImages` array in the workflow dispatch payload uses base64 only for the CDN upload step inside the workflow.

- **Pending CDN UI:** How should the carousel handle a slot where `pendingCDN: true`? Show a loading placeholder for that slot while the `full_workflow` completes, then swap in the real image when the Discussion is confirmed.

- **Workflow dispatch token scope:** The `actions:write` token is shared across all users of the app and lives in the frontend environment. Its limited scope makes this acceptable, but it should be rotated periodically and scoped to the minimum required repo.
