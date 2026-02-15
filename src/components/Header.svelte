<script lang="ts">
  import { isAuthenticated, currentUser, authReady } from '../lib/stores/auth';
  import { config } from '../lib/config';
  import { theme, type ThemePreference } from '../lib/stores/theme';
  import SignInModal from './SignInModal.svelte';
  import PostComposer from './PostComposer.svelte';

  let menuOpen = $state(false);
  let userMenuOpen = $state(false);
  let signInOpen = $state(false);
  let themeMenuOpen = $state(false);

  const themeOptions: { value: ThemePreference; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'System', icon: '💻' },
  ];

  // Init theme on mount
  $effect(() => {
    theme.init();
  });

  // Close dropdowns on outside clicks
  $effect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-user-menu]')) {
        userMenuOpen = false;
        themeMenuOpen = false;
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

<header class="sticky top-0 z-50 border-b border-border-subtle bg-surface/95 backdrop-blur-md">
  <div class="mx-auto flex max-w-7xl items-center justify-between px-[var(--spacing-page)] py-4">
    <!-- Logo -->
    <a href="/design-drops/" class="group flex items-center gap-3">
      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="5" r="3" fill="var(--color-surface)" />
          <ellipse cx="7" cy="12" rx="5" ry="2" fill="var(--color-surface)" opacity="0.6" />
        </svg>
      </div>
      <span class="font-heading text-xl tracking-tight text-text-primary group-hover:text-accent transition-colors">
        Design Drops
      </span>
    </a>

    <!-- Nav -->
    <nav class="hidden items-center gap-6 md:flex">
      <PostComposer />
      {#if $authReady && $isAuthenticated}
        <!-- User menu -->
        <div class="relative" data-user-menu>
          <button
            class="flex items-center gap-2 rounded-full border border-border px-1.5 py-1.5 pr-3 text-sm text-text-secondary hover:border-text-muted hover:text-text-primary transition-colors"
            onclick={() => (userMenuOpen = !userMenuOpen)}
            aria-label="User menu"
          >
            <img src={`https://github.com/${$currentUser?.login}.png`} alt={$currentUser?.login ?? ''} class="h-6 w-6 rounded-full object-cover" />
            <span class="text-sm">{$currentUser?.login ?? ''}</span>
          </button>
          {#if userMenuOpen}
            <div class="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-border bg-surface-raised p-1.5 shadow-xl animate-fade-in">
              <a
                href={`${config.site.basePath}/user/${$currentUser?.login}`}
                class="block w-full rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
              >
                Profile
              </a>
              <!-- Theme sub-menu -->
              <div class="relative" data-theme-menu>
                <button
                  class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
                  onclick={(e) => { e.stopPropagation(); themeMenuOpen = !themeMenuOpen; }}
                >
                  <span>Theme</span>
                  <span class="text-xs text-text-muted">
                    {#if $theme === 'dark'}🌙{:else if $theme === 'light'}☀️{:else}💻{/if}
                  </span>
                </button>
                {#if themeMenuOpen}
                  <div class="absolute right-full top-0 mr-2 w-36 rounded-xl border border-border bg-surface-raised p-1.5 shadow-xl animate-fade-in">
                    {#each themeOptions as opt}
                      <button
                        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors {$theme === opt.value ? 'bg-surface-overlay text-text-primary font-medium' : 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary'}"
                        onclick={(e) => { e.stopPropagation(); theme.set(opt.value); themeMenuOpen = false; }}
                      >
                        <span class="text-xs">{opt.icon}</span>
                        {opt.label}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
              <a
                href={`${config.site.basePath}/settings`}
                class="block w-full rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
              >
                Settings
              </a>
            </div>
          {/if}
        </div>
      {:else if $authReady}
        <button
          class="rounded-full border border-border px-5 py-2 text-sm text-text-secondary hover:border-text-muted hover:text-text-primary transition-colors"
          onclick={() => (signInOpen = true)}
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
    <div class="border-t border-border-subtle bg-surface px-[var(--spacing-page)] py-6 md:hidden animate-fade-in">
      <div class="flex flex-col gap-4">
        <PostComposer />
        {#if $authReady && $isAuthenticated}
          <div class="flex items-center gap-2 text-sm text-text-secondary">
            <img src={`https://github.com/${$currentUser?.login}.png`} alt={$currentUser?.login ?? ''} class="h-6 w-6 rounded-full object-cover" />
            <span>{$currentUser?.login}</span>
          </div>
          <a
            href={`${config.site.basePath}/user/${$currentUser?.login}`}
            class="rounded-full border border-border px-5 py-2.5 text-sm text-text-secondary text-center"
          >
            Profile
          </a>
          <a
            href={`${config.site.basePath}/settings`}
            class="rounded-full border border-border px-5 py-2.5 text-sm text-text-secondary text-center"
          >
            Settings
          </a>
          <!-- Mobile theme selector -->
          <div class="flex items-center justify-center gap-2 pt-2">
            {#each themeOptions as opt}
              <button
                class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors {$theme === opt.value ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-text-muted'}"
                onclick={() => theme.set(opt.value)}
              >
                <span>{opt.icon}</span>
                {opt.label}
              </button>
            {/each}
          </div>
        {:else if $authReady}
          <button
            class="rounded-full border border-border px-5 py-2.5 text-sm text-text-secondary"
            onclick={() => (signInOpen = true)}
          >
            Sign in with GitHub
          </button>
        {/if}
      </div>
    </div>
  {/if}
</header>

<SignInModal bind:open={signInOpen} />
