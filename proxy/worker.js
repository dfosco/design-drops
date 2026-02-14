/**
 * Cloudflare Worker — GitHub OAuth PKCE token exchange proxy.
 * Exists only because GitHub's token endpoint doesn't support CORS.
 * No secrets stored — just forwards the PKCE code_verifier from the client.
 *
 * Deploy: npx wrangler deploy proxy/worker.js --name drops-oauth
 */

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(request) });
    }

    try {
      const body = await request.json();
      const { client_id, code, redirect_uri, code_verifier } = body;

      if (!client_id || !code || !code_verifier) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: client_id, code, code_verifier' }),
          { status: 400, headers: { ...corsHeaders(request), 'Content-Type': 'application/json' } }
        );
      }

      // Forward to GitHub's token endpoint (server-side, no CORS issue)
      const ghResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id,
          code,
          redirect_uri,
          code_verifier,
          grant_type: 'authorization_code',
        }),
      });

      const data = await ghResponse.json();

      return new Response(JSON.stringify(data), {
        status: ghResponse.status,
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Proxy error', message: err.message }),
        { status: 500, headers: { ...corsHeaders(request), 'Content-Type': 'application/json' } }
      );
    }
  },
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
