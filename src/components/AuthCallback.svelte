<script lang="ts">
  import { exchangeCodeForToken, fetchUser } from '../lib/auth/oauth';
  import { auth } from '../lib/stores/auth';

  let status: 'loading' | 'success' | 'error' = $state('loading');
  let errorMessage = $state('');

  $effect(() => {
    handleCallback();
  });

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      status = 'error';
      errorMessage = params.get('error_description') ?? 'Authorization was denied.';
      return;
    }

    if (!code) {
      status = 'error';
      errorMessage = 'No authorization code received.';
      return;
    }

    try {
      const token = await exchangeCodeForToken(code);
      const user = await fetchUser(token);
      auth.login(token, user);
      status = 'success';

      // Clean the URL and redirect to feed
      setTimeout(() => {
        window.location.href = '/design-drops/';
      }, 1000);
    } catch (err) {
      status = 'error';
      errorMessage = err instanceof Error ? err.message : 'Authentication failed.';
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-[var(--color-surface)]">
  <div class="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-8 text-center">
    {#if status === 'loading'}
      <div class="mb-4 flex justify-center">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]"></div>
      </div>
      <p class="text-sm text-[var(--color-text-secondary)]">Signing you in…</p>

    {:else if status === 'success'}
      <div class="mb-4 text-4xl">✓</div>
      <p class="text-sm font-medium text-[var(--color-text-primary)]">Signed in!</p>
      <p class="mt-1 text-xs text-[var(--color-text-muted)]">Redirecting…</p>

    {:else}
      <div class="mb-4 text-4xl">✕</div>
      <p class="text-sm font-medium text-[var(--color-text-primary)]">Sign in failed</p>
      <p class="mt-2 text-xs text-[var(--color-text-muted)]">{errorMessage}</p>
      <a
        href="/design-drops/"
        class="mt-4 inline-block text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
      >
        Back to feed
      </a>
    {/if}
  </div>
</div>
