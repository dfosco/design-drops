<script lang="ts">
  import type { Post } from '../lib/types/post';
  import { slugify } from '../lib/slug';
  import { config } from '../lib/config';
  import { authToken } from '../lib/stores/auth';
  import { fetchAuthImage } from '../lib/api/image';

  import { postUrl } from '../lib/api/queries';

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

  const thumbnailRawUrl = $derived(post.metadata.assets[0]?.url ?? '');
  const hasMultipleImages = $derived(post.metadata.assets.length > 1);

  let thumbnail = $state('');

  $effect(() => {
    const token = $authToken;
    const rawUrl = thumbnailRawUrl;
    if (!token || !rawUrl) {
      thumbnail = rawUrl;
      return;
    }
    fetchAuthImage(rawUrl, token).then((blobUrl) => {
      thumbnail = blobUrl;
    });
  });
</script>

<a
  href={postUrl(post)}
  class="group block animate-fade-up"
  style="animation-delay: {index * 80}ms"
>
  <article class="overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised transition-all duration-300 hover:border-border hover:shadow-lg hover:shadow-black/5">
    <!-- Thumbnail -->
    {#if thumbnail}
      <div class="relative aspect-[4/3] overflow-hidden bg-surface-overlay">
        <img
          src={thumbnail}
          alt={post.metadata.title}
          class="h-full w-full object-cover"
          loading="lazy"
        />
        {#if hasMultipleImages}
          <div class="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-surface/80 px-2.5 py-1 backdrop-blur-sm">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="var(--color-text-secondary)">
              <rect x="1" y="3" width="7" height="7" rx="1" stroke="currentColor" fill="none" stroke-width="1" />
              <rect x="4" y="1" width="7" height="7" rx="1" stroke="currentColor" fill="none" stroke-width="1" />
            </svg>
            <span class="text-sm text-text-secondary">{post.metadata.assets.length}</span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Content -->
    <div class="p-5">
      <!-- Team & Project -->
      <div class="mb-2 flex items-center gap-2 text-sm text-text-muted">
        <span>{post.metadata.team}</span>
        {#if post.metadata.project}
          <span class="opacity-40">·</span>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span class="cursor-pointer hover:text-accent transition-colors"
            onclick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `${config.site.basePath}/project/${slugify(post.metadata.project)}`; }}>
            {post.metadata.project}
          </span>
        {/if}
      </div>

      <!-- Title -->
      <h2 class="mb-3 font-heading text-2xl font-semibold leading-snug text-text-primary group-hover:text-accent transition-colors">
        {post.metadata.title}
      </h2>

      <!-- Body preview -->
      <p class="mb-4 line-clamp-2 text-base leading-relaxed text-text-secondary">
        {post.body}
      </p>

      <!-- Footer -->
      <div class="flex items-center justify-between">
        <!-- Authors -->
        <div class="flex items-center gap-2">
          <div class="flex -space-x-2">
            {#each post.metadata.authors as author}
              <img src={`https://github.com/${author}.png`} alt={author} class="h-6 w-6 rounded-full border-2 border-surface-raised object-cover" loading="lazy" />
            {/each}
          </div>
          {#if post.metadata.collaborators && post.metadata.collaborators.length > 0}
            <span class="text-sm text-text-muted">+</span>
            <div class="flex -space-x-1.5">
              {#each post.metadata.collaborators as collab}
                <img src={`https://github.com/${collab}.png`} alt={collab} class="h-5 w-5 rounded-full border-2 border-surface-raised object-cover" loading="lazy" />
              {/each}
            </div>
          {/if}
          <span class="text-sm text-text-muted">
            {#each post.metadata.authors as author, i}
              <span
                role="link"
                tabindex="0"
                class="cursor-pointer hover:text-accent transition-colors"
                onclick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `${config.site.basePath}/user/${author}`; }}
                onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); window.location.href = `${config.site.basePath}/user/${author}`; } }}
              >{author}</span>{#if i < post.metadata.authors.length - 1}, {/if}
            {/each}
          </span>
        </div>

        <!-- Meta -->
        <div class="flex items-center gap-3 text-sm text-text-muted">
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
        <div class="mt-3 flex flex-wrap gap-1.5 border-t border-border-subtle pt-3">
          {#each post.metadata.tags as tag}
            <span class="rounded-full bg-surface-overlay px-2.5 py-0.5 text-xs text-text-muted transition-colors group-hover:text-text-secondary">
              {tag}
            </span>
          {/each}
        </div>
      {/if}
    </div>
  </article>
</a>
