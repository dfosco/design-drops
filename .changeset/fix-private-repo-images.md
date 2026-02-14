---
"drops": minor
---

Fix broken image rendering in private repos. Images stored on the `media` branch via `raw.githubusercontent.com` URLs returned 404 for unauthenticated `<img>` requests. Added authenticated image fetching through the GitHub Contents API with blob URL caching.
