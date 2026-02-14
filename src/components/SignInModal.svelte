<script lang="ts">
  import { auth } from '../lib/stores/auth';
  import { getTokenCreationUrl, TOKEN_EXPIRATION_HINT, validateToken } from '../lib/auth/oauth';
  import { config } from '../lib/config';

  let { open = $bindable(false), dismissable = true } = $props();

  let token = $state('');
  let status: 'idle' | 'validating' | 'error' = $state('idle');
  let errorMessage = $state('');

  async function handleConnect() {
    const trimmed = token.trim();
    if (!trimmed) return;

    status = 'validating';
    errorMessage = '';

    try {
      const user = await validateToken(trimmed);
      auth.login(trimmed, user);
      token = '';
      status = 'idle';
      open = false;
    } catch (err) {
      status = 'error';
      errorMessage = err instanceof Error ? err.message : 'Validation failed.';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && dismissable) {
      open = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget && dismissable) {
      open = false;
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in {dismissable ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/40 backdrop-blur-md'}"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label="Sign in"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div class="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-8 shadow-2xl animate-fade-up">
      <!-- Header -->
      <div class="mb-6">
        <h2 class="font-[var(--font-display)] text-2xl font-bold text-[var(--color-text-primary)]">
          Sign in to Design Drops
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Generate a Personal Access Token on GitHub and paste it below.
          Your token is stored only in this browser.
        </p>
      </div>

      <!-- Step 1: Generate token -->
      <div class="mb-6">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          Step 1
        </h3>
        <a
          href={getTokenCreationUrl()}
          target="_blank"
          rel="noopener noreferrer"
          class="group flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-4 py-3 text-sm text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" class="shrink-0 opacity-60 group-hover:opacity-100">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span class="font-medium">Generate token on GitHub</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" class="ml-auto opacity-40 group-hover:opacity-100">
            <path d="M4 2h6v6M10 2L4 8" />
          </svg>
        </a>
        <p class="mt-2 text-xs text-[var(--color-text-muted)]">
          Opens GitHub with the right permissions pre-selected. {TOKEN_EXPIRATION_HINT}
        </p>
      </div>

      <!-- Step 2: Paste token -->
      <div class="mb-6">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          Step 2
        </h3>
        <div class="relative">
          <input
            type="password"
            bind:value={token}
            placeholder="ghp_xxxxxxxxxxxx"
            class="w-full rounded-xl border bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 transition-colors {status === 'error'
              ? 'border-red-500/50 focus:ring-red-500/20'
              : 'border-[var(--color-border)] focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]'}"
            onkeydown={(e) => { if (e.key === 'Enter') handleConnect(); }}
            disabled={status === 'validating'}
          />
        </div>
        {#if status === 'error'}
          <p class="mt-2 text-xs text-red-400">{errorMessage}</p>
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button
          class="flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors {token.trim()
            ? 'bg-[var(--color-accent)] text-[var(--color-surface)] hover:bg-[var(--color-accent-hover)]'
            : 'bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] cursor-not-allowed'}"
          onclick={handleConnect}
          disabled={!token.trim() || status === 'validating'}
        >
          {#if status === 'validating'}
            <span class="inline-flex items-center gap-2">
              <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
              Validating…
            </span>
          {:else}
            Connect
          {/if}
        </button>
        {#if dismissable}
          <button
            class="rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] transition-colors"
            onclick={() => (open = false)}
          >
            Cancel
          </button>
        {/if}
      </div>

      <!-- Privacy note -->
      <p class="mt-4 text-center text-xs text-[var(--color-text-muted)]">
        Your token never leaves this browser. It's stored in localStorage and used only for GitHub API calls.
      </p>

      <!-- Admin notice -->
      <p class="mt-3 text-center text-xs text-[var(--color-text-muted)]">
        This application is fully hosted on
        <a href={config.repo.url} target="_blank" rel="noopener noreferrer" class="underline hover:text-[var(--color-text-secondary)] transition-colors">{config.repo.url.replace('https://', '')}</a>
        and administrated by
        <a href="https://github.com/{config.repo.admin}" target="_blank" rel="noopener noreferrer" class="underline hover:text-[var(--color-text-secondary)] transition-colors">@{config.repo.admin}</a>
      </p>
    </div>
  </div>
{/if}
