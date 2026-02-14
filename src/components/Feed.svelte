<script lang="ts">
  import type { Post } from '../lib/types/post';
  import PostCard from './PostCard.svelte';
  import { MOCK_POSTS } from '../lib/mock-data';
  import { config } from '../lib/config';
  import localstory from 'localstory';

  type FilterType = 'team' | 'project' | 'tag' | 'author';
  type ViewMode = 'feed' | 'grid';

  let { preview = false } = $props();

  const prefs = localstory(globalThis.localStorage, 'dd-prefs');

  // Show mock posts in preview mode (logged-out) or when mockPosts config is on
  let posts: Post[] = $state(preview || config.features.mockPosts ? MOCK_POSTS : []);
  let viewMode: ViewMode = $state((prefs.get('viewMode') as ViewMode) || 'feed');

  $effect(() => {
    prefs.set('viewMode', viewMode);
  });

  // Track which dropdown is open in grid mode
  let openDropdown: FilterType | null = $state(null);

  let activeFilters: Record<FilterType, Set<string>> = $state({
    team: new Set(),
    project: new Set(),
    tag: new Set(),
    author: new Set(),
  });

  const allTeams = $derived([...new Set(posts.map((p) => p.metadata.team))]);
  const allProjects = $derived([...new Set(posts.map((p) => p.metadata.project).filter(Boolean))]);
  const allTags = $derived([...new Set(posts.flatMap((p) => p.metadata.tags))]);
  const allAuthors = $derived([...new Set(posts.flatMap((p) => p.metadata.authors))]);

  const hasActiveFilters = $derived(
    activeFilters.team.size > 0 ||
    activeFilters.project.size > 0 ||
    activeFilters.tag.size > 0 ||
    activeFilters.author.size > 0
  );

  const activeFilterLabels = $derived(
    [
      ...Array.from(activeFilters.team),
      ...Array.from(activeFilters.project),
      ...Array.from(activeFilters.tag),
      ...Array.from(activeFilters.author),
    ]
  );

  const filteredPosts = $derived(
    hasActiveFilters
      ? posts.filter((p) => {
          if (activeFilters.team.size > 0 && !activeFilters.team.has(p.metadata.team)) return false;
          if (activeFilters.project.size > 0 && !activeFilters.project.has(p.metadata.project)) return false;
          if (activeFilters.tag.size > 0 && !p.metadata.tags.some((t) => activeFilters.tag.has(t))) return false;
          if (activeFilters.author.size > 0 && !p.metadata.authors.some((a) => activeFilters.author.has(a))) return false;
          return true;
        })
      : posts
  );

  function toggleFilter(type: FilterType, value: string) {
    const next = new Set(activeFilters[type]);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    activeFilters = { ...activeFilters, [type]: next };
  }

  function clearFilters() {
    activeFilters = { team: new Set(), project: new Set(), tag: new Set(), author: new Set() };
  }

  function isActive(type: FilterType, value: string) {
    return activeFilters[type].has(value);
  }

  function toggleDropdown(type: FilterType) {
    openDropdown = openDropdown === type ? null : type;
  }

  function dropdownLabel(type: FilterType, allValues: string[]): string {
    const selected = activeFilters[type];
    if (selected.size === 0) {
      const labels: Record<FilterType, string> = { team: 'Team', project: 'Project', tag: 'Tag', author: 'Person' };
      return labels[type];
    }
    if (selected.size === 1) return Array.from(selected)[0];
    return `${selected.size} selected`;
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-dropdown]')) {
      openDropdown = null;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<!-- View toggle icons (shared) -->
{#snippet viewToggle()}
  <div class="inline-flex rounded-lg border border-[var(--color-border)] p-0.5">
    <button
      class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors {viewMode === 'feed'
        ? 'bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)] font-medium'
        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}"
      onclick={() => (viewMode = 'feed')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" opacity="0.7">
        <rect x="1" y="1" width="12" height="3" rx="0.5" />
        <rect x="1" y="6" width="12" height="3" rx="0.5" />
        <rect x="1" y="11" width="12" height="3" rx="0.5" />
      </svg>
      Feed
    </button>
    <button
      class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors {viewMode === 'grid'
        ? 'bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)] font-medium'
        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}"
      onclick={() => (viewMode = 'grid')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" opacity="0.7">
        <rect x="1" y="1" width="5" height="5" rx="0.5" />
        <rect x="8" y="1" width="5" height="5" rx="0.5" />
        <rect x="1" y="8" width="5" height="5" rx="0.5" />
        <rect x="8" y="8" width="5" height="5" rx="0.5" />
      </svg>
      Grid
    </button>
  </div>
{/snippet}

<!-- Dropdown filter button + panel (shared) -->
{#snippet filterDropdown(type: FilterType, values: string[])}
  <div class="relative" data-dropdown>
    <button
      class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors {activeFilters[type].size > 0
        ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 text-[var(--color-accent)] font-medium'
        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}"
      onclick={(e) => { e.stopPropagation(); toggleDropdown(type); }}
    >
      {dropdownLabel(type, values)}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" class="opacity-50">
        <path d="M2 4l3 3 3-3" />
      </svg>
    </button>
    {#if openDropdown === type}
      <div class="absolute left-0 top-full z-50 mt-1.5 min-w-[180px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-1.5 shadow-xl animate-fade-in">
        {#each values as value}
          <button
            class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors {isActive(type, value)
              ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)]'}"
            onclick={(e) => { e.stopPropagation(); toggleFilter(type, value); }}
          >
            <!-- Checkbox -->
            <div class="flex h-4 w-4 items-center justify-center rounded border transition-colors {isActive(type, value) ? 'border-[var(--color-accent)] bg-[var(--color-accent)]' : 'border-[var(--color-border)]'}">
              {#if isActive(type, value)}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--color-surface)" stroke-width="1.5">
                  <path d="M2 5l2.5 2.5L8 3" />
                </svg>
              {/if}
            </div>
            {#if type === 'author'}
              <div class="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface-overlay)] text-[9px] font-medium uppercase text-[var(--color-text-muted)]">
                {value[0]}
              </div>
            {/if}
            {value}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<div class="mx-auto max-w-7xl px-[var(--spacing-page)] pt-28 pb-20">
  <!-- Page header -->
  <div class="mb-12 animate-fade-up">
    <h1 class="mb-3 font-[var(--font-display)] text-5xl font-bold leading-tight tracking-tight text-[var(--color-text-primary)] md:text-7xl">
      Latest drops
    </h1>
    <p class="max-w-xl text-lg leading-relaxed text-[var(--color-text-secondary)] font-medium">
      What the team's been working on
    </p>
  </div>

  {#if viewMode === 'grid'}
    <!-- GRID MODE: filters as top bar dropdowns -->
    <div class="relative z-30 mb-8 flex flex-wrap items-center gap-3 animate-fade-up">
      {@render viewToggle()}
      <div class="mx-2 h-6 w-px bg-[var(--color-border)]"></div>
      {@render filterDropdown('author', allAuthors)}
      {@render filterDropdown('team', allTeams)}
      {@render filterDropdown('project', allProjects)}
      {@render filterDropdown('tag', allTags)}
      {#if hasActiveFilters}
        <button
          class="ml-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          onclick={clearFilters}
        >
          Clear all
        </button>
      {/if}
    </div>

    <!-- Active filter pills -->
    {#if hasActiveFilters}
      <div class="mb-6 flex flex-wrap items-center gap-2 animate-fade-up">
        {#each activeFilterLabels as label}
          <span class="rounded-full bg-[var(--color-accent)]/10 px-3 py-1 text-sm font-medium text-[var(--color-accent)]">
            {label}
          </span>
        {/each}
      </div>
    {/if}

    <!-- Grid content -->
    {#if filteredPosts.length === 0}
      <div class="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
        <div class="mb-4 text-6xl opacity-20">✦</div>
        {#if posts.length === 0}
          <p class="text-xl font-medium text-[var(--color-text-secondary)]">No drops yet</p>
          <p class="mt-2 max-w-sm text-sm text-[var(--color-text-muted)]">
            Be the first to share what your team's been working on. Hit the + button to post a new drop.
          </p>
        {:else}
          <p class="text-lg text-[var(--color-text-muted)]">No drops match this filter</p>
          <button
            class="mt-3 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            onclick={clearFilters}
          >
            Clear filters
          </button>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {#each filteredPosts as post, i (post.id)}
          <PostCard {post} index={i} />
        {/each}
      </div>
    {/if}

  {:else}
    <!-- FEED MODE: sidebar layout -->
    <div class="flex gap-10 lg:gap-14">
      <!-- Feed column -->
      <div class="min-w-0 flex-1 max-w-3xl">
        {#if hasActiveFilters}
          <div class="mb-6 flex flex-wrap items-center gap-2 animate-fade-up">
            <span class="text-sm text-[var(--color-text-muted)]">Filtered by</span>
            {#each activeFilterLabels as label}
              <span class="rounded-full bg-[var(--color-accent)]/10 px-3 py-1 text-sm font-medium text-[var(--color-accent)]">
                {label}
              </span>
            {/each}
            <button
              class="ml-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              onclick={clearFilters}
            >
              Clear all
            </button>
          </div>
        {/if}

        {#if filteredPosts.length === 0}
          <div class="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
            <div class="mb-4 text-6xl opacity-20">✦</div>
            {#if posts.length === 0}
              <p class="text-xl font-medium text-[var(--color-text-secondary)]">No drops yet</p>
              <p class="mt-2 max-w-sm text-sm text-[var(--color-text-muted)]">
                Be the first to share what your team's been working on. Hit the + button to post a new drop.
              </p>
            {:else}
              <p class="text-lg text-[var(--color-text-muted)]">No drops match this filter</p>
              <button
                class="mt-3 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
                onclick={clearFilters}
              >
                Clear filters
              </button>
            {/if}
          </div>
        {:else}
          <div class="flex flex-col gap-8">
            {#each filteredPosts as post, i (post.id)}
              <PostCard {post} index={i} />
            {/each}
          </div>
        {/if}
      </div>

      <!-- Sidebar -->
      <aside class="hidden w-64 shrink-0 lg:block animate-fade-up" style="animation-delay: 80ms">
        <div class="sticky top-28 space-y-8">
          <!-- View toggle -->
          <div>
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">View</h3>
            {@render viewToggle()}
          </div>

          <!-- People -->
          <div>
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">People</h3>
            <ul class="space-y-1">
              {#each allAuthors as author}
                <li>
                  <button
                    class="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm transition-colors {isActive('author', author)
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)]'}"
                    onclick={() => toggleFilter('author', author)}
                  >
                    <div class="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-overlay)] text-[10px] font-medium uppercase text-[var(--color-text-muted)] {isActive('author', author) ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : ''}">
                      {author[0]}
                    </div>
                    {author}
                  </button>
                </li>
              {/each}
            </ul>
          </div>

          <!-- Teams -->
          <div>
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Teams</h3>
            <ul class="space-y-1">
              {#each allTeams as team}
                <li>
                  <button
                    class="w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors {isActive('team', team)
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)]'}"
                    onclick={() => toggleFilter('team', team)}
                  >
                    {team}
                  </button>
                </li>
              {/each}
            </ul>
          </div>

          <!-- Projects -->
          <div>
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Projects</h3>
            <ul class="space-y-1">
              {#each allProjects as project}
                <li>
                  <button
                    class="w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors {isActive('project', project)
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)]'}"
                    onclick={() => toggleFilter('project', project)}
                  >
                    {project}
                  </button>
                </li>
              {/each}
            </ul>
          </div>

          <!-- Tags -->
          <div>
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Tags</h3>
            <div class="flex flex-wrap gap-1.5">
              {#each allTags as tag}
                <button
                  class="rounded-full px-2.5 py-1 text-xs transition-colors {isActive('tag', tag)
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
                    : 'bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}"
                  onclick={() => toggleFilter('tag', tag)}
                >
                  {tag}
                </button>
              {/each}
            </div>
          </div>

          <!-- Clear all -->
          {#if hasActiveFilters}
            <button
              class="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] transition-colors"
              onclick={clearFilters}
            >
              Clear all filters
            </button>
          {/if}
        </div>
      </aside>
    </div>
  {/if}
</div>
