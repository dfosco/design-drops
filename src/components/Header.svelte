<script lang="ts">
  import { auth, isAuthenticated, currentUser } from '../lib/stores/auth';
  import { getAuthorizeUrl } from '../lib/auth/oauth';

  let menuOpen = $state(false);
  let userMenuOpen = $state(false);

  function signIn() {
    window.location.href = getAuthorizeUrl();
  }

  function signOut() {
    auth.logout();
    userMenuOpen = false;
  }
</script>

<header class="fixed top-0 left-0 right-0 z-50 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/95 backdrop-blur-md">
  <div class="mx-auto flex max-w-7xl items-center justify-between px-[var(--spacing-page)] py-4">
    <!-- Logo -->
    <a href="/design-drops/" class="group flex items-center gap-3">
      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)]">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="5" r="3" fill="var(--color-surface)" />
          <ellipse cx="7" cy="12" rx="5" ry="2" fill="var(--color-surface)" opacity="0.6" />
        </svg>
      </div>
      <span class="font-[var(--font-display)] text-xl tracking-tight text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
        Design Drops
      </span>
    </a>

    <!-- Nav -->
    <nav class="hidden items-center gap-6 md:flex">
      <a href="/design-drops/" class="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
        Feed
      </a>
      {#if $isAuthenticated}
        <!-- User menu -->
        <div class="relative">
          <button
            class="flex items-center gap-2 rounded-full border border-[var(--color-border)] px-1.5 py-1.5 pr-3 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            onclick={() => (userMenuOpen = !userMenuOpen)}
            aria-label="User menu"
          >
            {#if $currentUser?.avatarUrl}
              <img
                src={$currentUser.avatarUrl}
                alt={$currentUser.login}
                class="h-6 w-6 rounded-full"
              />
            {:else}
              <div class="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-overlay)] text-[10px] font-medium uppercase text-[var(--color-text-muted)]">
                {$currentUser?.login?.[0] ?? '?'}
              </div>
            {/if}
            <span class="text-sm">{$currentUser?.login ?? ''}</span>
          </button>
          {#if userMenuOpen}
            <div class="absolute right-0 top-full z-50 mt-2 w-40 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-1.5 shadow-xl animate-fade-in">
              <button
                class="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)] transition-colors"
                onclick={signOut}
              >
                Sign out
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <button
          class="rounded-full border border-[var(--color-border)] px-5 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          onclick={signIn}
        >
          Sign in with GitHub
        </button>
      {/if}
    </nav>

    <!-- Mobile toggle -->
    <button
      class="flex h-8 w-8 items-center justify-center md:hidden"
      onclick={() => (menuOpen = !menuOpen)}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="var(--color-text-secondary)">
        {#if menuOpen}
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" fill="none" />
        {:else}
          <rect x="3" y="5" width="14" height="1.5" rx="0.75" />
          <rect x="3" y="9.5" width="14" height="1.5" rx="0.75" />
          <rect x="3" y="14" width="14" height="1.5" rx="0.75" />
        {/if}
      </svg>
    </button>
  </div>

  <!-- Mobile menu -->
  {#if menuOpen}
    <div class="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-[var(--spacing-page)] py-6 md:hidden animate-fade-in">
      <div class="flex flex-col gap-4">
        <a href="/design-drops/" class="text-sm text-[var(--color-text-secondary)]">Feed</a>
        {#if $isAuthenticated}
          <div class="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            {#if $currentUser?.avatarUrl}
              <img src={$currentUser.avatarUrl} alt={$currentUser.login} class="h-6 w-6 rounded-full" />
            {/if}
            <span>{$currentUser?.login}</span>
          </div>
          <button
            class="rounded-full border border-[var(--color-border)] px-5 py-2.5 text-sm text-[var(--color-text-secondary)]"
            onclick={signOut}
          >
            Sign out
          </button>
        {:else}
          <button
            class="rounded-full border border-[var(--color-border)] px-5 py-2.5 text-sm text-[var(--color-text-secondary)]"
            onclick={signIn}
          >
            Sign in with GitHub
          </button>
        {/if}
      </div>
    </div>
  {/if}
</header>
