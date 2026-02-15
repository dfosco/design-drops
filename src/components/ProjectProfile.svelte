<script lang="ts">
  import type { Post } from '../lib/types/post';
  import PostCard from './PostCard.svelte';
  import { config } from '../lib/config';
  import { auth, authToken } from '../lib/stores/auth';
  import { fetchPosts, fetchRepoIds } from '../lib/api/queries';
  import { AuthError } from '../lib/api/graphql';
  import { slugify } from '../lib/slug';

  let projectSlug = $state('');
  let projectName = $state('');
  let allPosts: Post[] = $state([]);
  let loading = $state(true);

  // Filters
  let authorFilter: Set<string> = $state(new Set());
  let tagFilter: Set<string> = $state(new Set());

  function getProjectSlugFromPath(): string | null {
    const prefix = `${config.site.basePath}/project/`;
    const path = window.location.pathname;
    if (!path.startsWith(prefix)) return null;
    const slug = path.slice(prefix.length).replace(/\/+$/, '');
    return slug || null;
  }

  $effect(() => {
    const slug = getProjectSlugFromPath();
    if (!slug) { loading = false; return; }
    projectSlug = slug;

    const token = $authToken;
    if (!token) { loading = false; return; }

    loading = true;
    fetchRepoIds(token, config.repo.owner, config.repo.name, config.discussions.category)
      .then(({ categoryId }) => fetchPosts(token, config.repo.owner, config.repo.name, categoryId, 100))
      .then((posts) => {
        allPosts = posts;
        const match = posts.find(p => slugify(p.metadata.project) === slug);
        if (match) projectName = match.metadata.project;
        loading = false;
      })
      .catch((err) => {
        if (err instanceof AuthError) { auth.logout(); return; }
        loading = false;
      });
  });

  const projectPosts = $derived(
    allPosts.filter(p => slugify(p.metadata.project) === projectSlug)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );

  // All people involved (authors + collaborators)
  const allPeople = $derived([...new Set(
    projectPosts.flatMap(p => [...p.metadata.authors, ...(p.metadata.collaborators ?? [])])
  )]);

  const allTags = $derived([...new Set(projectPosts.flatMap(p => p.metadata.tags))]);
  const allTeams = $derived([...new Set(projectPosts.map(p => p.metadata.team).filter(Boolean))]);

  const hasFilters = $derived(authorFilter.size > 0 || tagFilter.size > 0);

  const filteredPosts = $derived(
    hasFilters
      ? projectPosts.filter(p => {
          if (authorFilter.size > 0 &&
            !p.metadata.authors.some(a => authorFilter.has(a)) &&
            !(p.metadata.collaborators ?? []).some(c => authorFilter.has(c))) return false;
          if (tagFilter.size > 0 && !p.metadata.tags.some(t => tagFilter.has(t))) return false;
          return true;
        })
      : projectPosts
  );

  function toggleAuthor(author: string) {
    const next = new Set(authorFilter);
    if (next.has(author)) next.delete(author); else next.add(author);
    authorFilter = next;
  }

  function toggleTag(tag: string) {
    const next = new Set(tagFilter);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    tagFilter = next;
  }

  function clearFilters() {
    authorFilter = new Set();
    tagFilter = new Set();
  }
</script>

<div class="mx-auto max-w-7xl px-[var(--spacing-page)] pt-10 pb-20">
  {#if loading}
    <div class="animate-pulse">
      <div class="mb-6 h-10 w-64 rounded bg-surface-overlay"></div>
      <div class="mb-4 h-4 w-48 rounded bg-surface-overlay"></div>
    </div>
  {:else if !projectName}
    <div class="flex flex-col items-center justify-center py-32 text-center animate-fade-up">
      <div class="mb-4 text-6xl opacity-20">✦</div>
      <p class="text-xl text-text-muted">Project not found</p>
      <a href={`${config.site.basePath}/`} class="mt-4 text-sm text-accent hover:text-accent-hover transition-colors">
        ← Back to feed
      </a>
    </div>
  {:else}
    <!-- Back link -->
    <a href={`${config.site.basePath}/`}
      class="mb-8 inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors animate-fade-up">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2L4 7l5 5" /></svg>
      Back to feed
    </a>

    <!-- Project header -->
    <div class="mb-10 animate-fade-up" style="animation-delay: 60ms">
      <h1 class="mb-3 font-heading text-4xl font-bold text-text-primary md:text-5xl">
        {projectName}
      </h1>

      <!-- Collaborators row -->
      <div class="flex items-center gap-4">
        <div class="flex -space-x-2">
          {#each allPeople.slice(0, 8) as person}
            <a href={`${config.site.basePath}/user/${person}`}>
              <img src={`https://github.com/${person}.png`} alt={person}
                class="h-8 w-8 rounded-full border-2 border-surface object-cover hover:ring-2 hover:ring-accent transition-shadow" />
            </a>
          {/each}
          {#if allPeople.length > 8}
            <div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-surface-overlay text-sm text-text-muted">
              +{allPeople.length - 8}
            </div>
          {/if}
        </div>
        <span class="text-sm text-text-muted">
          {projectPosts.length} {projectPosts.length === 1 ? 'post' : 'posts'} · {allPeople.length} {allPeople.length === 1 ? 'contributor' : 'contributors'}
        </span>
      </div>

      {#if allTeams.length > 0}
        <div class="mt-3 flex items-center gap-2 text-sm text-text-muted">
          <span>Teams:</span>
          {#each allTeams as team}
            <span class="rounded-full bg-surface-overlay px-2.5 py-0.5 text-sm">{team}</span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Main content with sidebar -->
    <div class="flex gap-10 lg:gap-14">
      <!-- Posts column -->
      <div class="min-w-0 flex-1 max-w-3xl">
        {#if hasFilters}
          <div class="mb-6 flex items-center gap-2 animate-fade-up">
            <span class="text-sm text-text-muted">Filtered</span>
            <button class="text-sm text-text-muted hover:text-text-primary transition-colors" onclick={clearFilters}>
              Clear all
            </button>
          </div>
        {/if}

        {#if filteredPosts.length === 0}
          <div class="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div class="mb-4 text-5xl opacity-20">✦</div>
            <p class="text-lg text-text-muted">No posts match this filter</p>
          </div>
        {:else}
          <div class="flex flex-col gap-8 animate-fade-up" style="animation-delay: 120ms">
            {#each filteredPosts as post, i (post.id)}
              <PostCard {post} index={i} />
            {/each}
          </div>
        {/if}
      </div>

      <!-- Sidebar filters -->
      <aside class="hidden w-64 shrink-0 lg:block animate-fade-up" style="animation-delay: 80ms">
        <div class="sticky top-28 space-y-8">
          <!-- People filter -->
          {#if allPeople.length > 0}
            <div>
              <h3 class="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">People</h3>
              <ul class="space-y-1">
                {#each allPeople as person}
                  <li>
                    <button
                      class="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm transition-colors {authorFilter.has(person)
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary'}"
                      onclick={() => toggleAuthor(person)}>
                      <img src={`https://github.com/${person}.png`} alt={person} class="h-6 w-6 rounded-full object-cover" />
                      {person}
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Tags filter -->
          {#if allTags.length > 0}
            <div>
              <h3 class="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">Tags</h3>
              <div class="flex flex-wrap gap-1.5">
                {#each allTags as tag}
                  <button
                    class="rounded-full px-2.5 py-1 text-sm transition-colors {tagFilter.has(tag)
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'bg-surface-overlay text-text-muted hover:text-text-secondary'}"
                    onclick={() => toggleTag(tag)}>
                    {tag}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Clear filters -->
          {#if hasFilters}
            <button
              class="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:border-text-muted transition-colors"
              onclick={clearFilters}>
              Clear all filters
            </button>
          {/if}
        </div>
      </aside>
    </div>
  {/if}
</div>
