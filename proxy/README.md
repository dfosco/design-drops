# OAuth Token Proxy

GitHub's token endpoint (`/login/oauth/access_token`) doesn't support CORS, so browsers can't call it directly. This tiny Cloudflare Worker proxies the PKCE token exchange — **no secrets are stored**, it just forwards the request and adds CORS headers.

## Deploy (one-time)

```bash
cd proxy
npx wrangler deploy
```

This gives you a URL like `https://drops-oauth.<your-account>.workers.dev`. Set it as `PUBLIC_OAUTH_PROXY_URL` in your `.env`.

## Local development

```bash
cd proxy
npx wrangler dev
```

Runs at `http://localhost:8787`. Already set as the default in `.env.example`.

## What it does

1. Receives `{ client_id, code, redirect_uri, code_verifier }` from the browser
2. Forwards it to `https://github.com/login/oauth/access_token`
3. Returns the response with CORS headers

No secrets, no state, no database. Just CORS headers.
