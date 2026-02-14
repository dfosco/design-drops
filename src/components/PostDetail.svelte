<script lang="ts">
  import type { Post } from '../lib/types/post';
  import ImageCarousel from './ImageCarousel.svelte';
  import { MOCK_POSTS } from '../lib/mock-data';

  let post: Post | null = $state(null);
  let loading = $state(true);
  let showDeleteConfirm = $state(false);

  $effect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      post = MOCK_POSTS.find((p) => p.id === id) ?? null;
    }
    loading = false;
  });

  const timeAgo = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
</script>

<div class="mx-auto max-w-4xl px-[var(--spacing-page)] pt-28 pb-20">
  {#if loading}
    <!-- Loading skeleton -->
    <div class="animate-pulse">
      <div class="mb-4 h-4 w-32 rounded bg-[var(--color-surface-overlay)]"></div>
      <div class="mb-6 h-10 w-3/4 rounded bg-[var(--color-surface-overlay)]"></div>
      <div class="aspect-[16/10] rounded-xl bg-[var(--color-surface-overlay)]"></div>
    </div>
  {:else if !post}
    <!-- Not found -->
    <div class="flex flex-col items-center justify-center py-32 text-center animate-fade-up">
      <div class="mb-4 text-6xl opacity-20">✦</div>
      <p class="text-xl text-[var(--color-text-muted)]">Post not found</p>
      <a
        href="/design-drops/"
        class="mt-4 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
      >
        ← Back to feed
      </a>
    </div>
  {:else}
    <!-- Back link -->
    <a
      href="/design-drops/"
      class="mb-8 inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors animate-fade-up"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 2L4 7l5 5" />
      </svg>
      Back to feed
    </a>

    <!-- Header -->
    <div class="mb-8 animate-fade-up" style="animation-delay: 60ms">
      <div class="mb-3 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <span>{post.metadata.team}</span>
        {#if post.metadata.project}
          <span class="opacity-40">·</span>
          <span>{post.metadata.project}</span>
        {/if}
        <span class="opacity-40">·</span>
        <span>{timeAgo(post.createdAt)}</span>
      </div>

      <h1 class="mb-4 font-[var(--font-display)] text-4xl font-bold leading-tight tracking-tight text-[var(--color-text-primary)] md:text-5xl">
        {post.metadata.title}
      </h1>

      <!-- Authors -->
      <div class="flex items-center gap-3">
        <div class="flex -space-x-2">
          {#each post.metadata.authors as author}
            <div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-surface-overlay)] text-xs font-medium uppercase text-[var(--color-text-muted)]">
              {author[0]}
            </div>
          {/each}
        </div>
        <span class="text-sm text-[var(--color-text-secondary)]">
          {post.metadata.authors.join(' & ')}
        </span>
      </div>
    </div>

    <!-- Carousel -->
    {#if post.metadata.assets.length > 0}
      <div class="mb-10 animate-fade-up" style="animation-delay: 120ms">
        <ImageCarousel assets={post.metadata.assets} title={post.metadata.title} />
      </div>
    {/if}

    <!-- Body -->
    <div class="mb-10 animate-fade-up" style="animation-delay: 180ms">
      <p class="max-w-2xl text-lg leading-relaxed text-[var(--color-text-secondary)]">
        {post.body}
      </p>
    </div>

    <!-- External URLs -->
    {#if post.metadata.urls.length > 0}
      <div class="mb-10 animate-fade-up" style="animation-delay: 240ms">
        <h3 class="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Links</h3>
        <div class="flex flex-wrap gap-3">
          {#each post.metadata.urls as url}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              class="group flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3 text-sm text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" class="opacity-50 group-hover:opacity-100">
                <path d="M6 2H3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V8" />
                <path d="M8 1h5v5M13 1L6 8" />
              </svg>
              <span class="max-w-[200px] truncate">{url.replace(/^https?:\/\//, '')}</span>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Tags -->
    {#if post.metadata.tags.length > 0}
      <div class="mb-10 animate-fade-up" style="animation-delay: 300ms">
        <h3 class="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Tags</h3>
        <div class="flex flex-wrap gap-2">
          {#each post.metadata.tags as tag}
            <span class="rounded-full bg-[var(--color-surface-overlay)] px-3 py-1 text-sm text-[var(--color-text-muted)]">
              {tag}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Actions -->
    <div class="flex items-center gap-3 border-t border-[var(--color-border-subtle)] pt-6 animate-fade-up" style="animation-delay: 360ms">
      <button
        class="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        Edit
      </button>
      <div class="relative">
        <button
          class="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-muted)] hover:border-red-500/50 hover:text-red-400 transition-colors"
          onclick={() => (showDeleteConfirm = !showDeleteConfirm)}
        >
          Delete
        </button>
        {#if showDeleteConfirm}
          <div class="absolute left-0 top-full mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 shadow-xl animate-fade-in z-10">
            <p class="mb-3 text-sm text-[var(--color-text-secondary)]">Delete this drop?</p>
            <div class="flex gap-2">
              <button
                class="rounded-full bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-400 transition-colors"
              >
                Yes, delete
              </button>
              <button
                class="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                onclick={() => (showDeleteConfirm = false)}
              >
                Cancel
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Comments placeholder -->
    <div class="mt-12 border-t border-[var(--color-border-subtle)] pt-8 animate-fade-up" style="animation-delay: 420ms">
      <h3 class="mb-6 font-[var(--font-display)] text-2xl text-[var(--color-text-primary)]">
        Comments
        {#if post.commentCount > 0}
          <span class="ml-2 text-lg text-[var(--color-text-muted)]">({post.commentCount})</span>
        {/if}
      </h3>

      <!-- Comment input -->
      <div class="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4">
        <textarea
          placeholder="Add a comment…"
          rows="3"
          class="w-full resize-none bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
        ></textarea>
        <div class="mt-3 flex justify-end">
          <button
            class="rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-surface)] opacity-50 cursor-not-allowed"
            disabled
          >
            Comment
          </button>
        </div>
      </div>

      <!-- Placeholder comments -->
      <div class="space-y-6 opacity-60">
        <p class="text-center text-sm text-[var(--color-text-muted)]">
          Comments will be wired up in a future release
        </p>
      </div>
    </div>
  {/if}
</div>
