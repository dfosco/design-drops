<script lang="ts">
  import type { Post } from '../lib/types/post';
  import { buildPostParam } from '../lib/slug';

  let { post, index = 0 }: { post: Post; index?: number } = $props();

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    const intervals = [
      { label: 'w', seconds: 604800 },
      { label: 'd', seconds: 86400 },
      { label: 'h', seconds: 3600 },
      { label: 'm', seconds: 60 },
    ];
    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds);
      if (count >= 1) return `${count}${interval.label} ago`;
    }
    return 'just now';
  };

  const thumbnail = $derived(post.metadata.assets[0]?.url ?? '');
  const hasMultipleImages = $derived(post.metadata.assets.length > 1);
</script>

<a
  href={`/design-drops/post/?s=${buildPostParam(post.metadata.title, post.id)}`}
  class="group block animate-fade-up"
  style="animation-delay: {index * 80}ms"
>
  <article class="overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] transition-all duration-300 hover:border-[var(--color-border)] hover:shadow-lg hover:shadow-black/5">
    <!-- Thumbnail -->
    {#if thumbnail}
      <div class="relative aspect-[4/3] overflow-hidden bg-[var(--color-surface-overlay)]">
        <img
          src={thumbnail}
          alt={post.metadata.title}
          class="h-full w-full object-cover"
          loading="lazy"
        />
        {#if hasMultipleImages}
          <div class="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-[var(--color-surface)]/80 px-2.5 py-1 backdrop-blur-sm">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="var(--color-text-secondary)">
              <rect x="1" y="3" width="7" height="7" rx="1" stroke="currentColor" fill="none" stroke-width="1" />
              <rect x="4" y="1" width="7" height="7" rx="1" stroke="currentColor" fill="none" stroke-width="1" />
            </svg>
            <span class="text-xs text-[var(--color-text-secondary)]">{post.metadata.assets.length}</span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Content -->
    <div class="p-5">
      <!-- Team & Project -->
      <div class="mb-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span>{post.metadata.team}</span>
        {#if post.metadata.project}
          <span class="opacity-40">·</span>
          <span>{post.metadata.project}</span>
        {/if}
      </div>

      <!-- Title -->
      <h2 class="mb-3 font-[var(--font-display)] text-2xl font-semibold leading-snug text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
        {post.metadata.title}
      </h2>

      <!-- Body preview -->
      <p class="mb-4 line-clamp-2 text-base leading-relaxed text-[var(--color-text-secondary)]">
        {post.body}
      </p>

      <!-- Footer -->
      <div class="flex items-center justify-between">
        <!-- Authors -->
        <div class="flex items-center gap-2">
          <div class="flex -space-x-2">
            {#each post.metadata.authors as author}
              <div class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--color-surface-raised)] bg-[var(--color-surface-overlay)] text-[10px] font-medium uppercase text-[var(--color-text-muted)]">
                {author[0]}
              </div>
            {/each}
          </div>
          <span class="text-xs text-[var(--color-text-muted)]">
            {post.metadata.authors.join(', ')}
          </span>
        </div>

        <!-- Meta -->
        <div class="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          {#if post.commentCount > 0}
            <span class="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" opacity="0.6">
                <path d="M1 3a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2H5l-2.5 2V9H3a2 2 0 01-2-2V3z" />
              </svg>
              {post.commentCount}
            </span>
          {/if}
          <span>{timeAgo(post.createdAt)}</span>
        </div>
      </div>

      <!-- Tags -->
      {#if post.metadata.tags.length > 0}
        <div class="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--color-border-subtle)] pt-3">
          {#each post.metadata.tags as tag}
            <span class="rounded-full bg-[var(--color-surface-overlay)] px-2.5 py-0.5 text-[11px] text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text-secondary)]">
              {tag}
            </span>
          {/each}
        </div>
      {/if}
    </div>
  </article>
</a>
