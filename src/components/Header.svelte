<script lang="ts">
  let { isLoggedIn = false }: { isLoggedIn?: boolean } = $props();

  let menuOpen = $state(false);
</script>

<header class="fixed top-0 left-0 right-0 z-50 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/95 backdrop-blur-md">
  <div class="mx-auto flex max-w-7xl items-center justify-between px-[var(--spacing-page)] py-4">
    <!-- Logo -->
    <a href="/" class="group flex items-center gap-3">
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
    <nav class="hidden items-center gap-8 md:flex">
      <a href="/" class="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
        Feed
      </a>
      {#if isLoggedIn}
        <button
          class="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          New Drop
        </button>
        <button class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" aria-label="User menu">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="2.5" />
            <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5H3z" />
          </svg>
        </button>
      {:else}
        <button
          class="rounded-full border border-[var(--color-border)] px-5 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
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
        <a href="/" class="text-sm text-[var(--color-text-secondary)]">Feed</a>
        {#if isLoggedIn}
          <button class="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-surface)]">
            New Drop
          </button>
        {:else}
          <button class="rounded-full border border-[var(--color-border)] px-5 py-2.5 text-sm text-[var(--color-text-secondary)]">
            Sign in with GitHub
          </button>
        {/if}
      </div>
    </div>
  {/if}
</header>
