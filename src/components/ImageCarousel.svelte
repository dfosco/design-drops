<script lang="ts">
  import type { Asset } from '../lib/types/post';
  import { authToken } from '../lib/stores/auth';
  import { fetchAuthImage } from '../lib/api/image';

  let { assets = [], title = '' }: { assets?: Asset[]; title?: string } = $props();

  let currentIndex = $state(0);
  let resolvedUrls: Record<string, string> = $state({});

  const total = $derived(assets.length);
  const canPrev = $derived(currentIndex > 0);
  const canNext = $derived(currentIndex < total - 1);

  // Resolve authenticated image URLs
  $effect(() => {
    const token = $authToken;
    if (!token) return;
    for (const asset of assets) {
      if (asset.url && !asset.pendingCDN && !resolvedUrls[asset.id]) {
        fetchAuthImage(asset.url, token).then((blobUrl) => {
          resolvedUrls = { ...resolvedUrls, [asset.id]: blobUrl };
        });
      }
    }
  });

  function prev() {
    if (canPrev) currentIndex--;
  }

  function next() {
    if (canNext) currentIndex++;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="relative overflow-hidden rounded-xl bg-[var(--color-surface-overlay)]">
  {#if assets.length === 0}
    <div class="flex aspect-[16/10] items-center justify-center text-[var(--color-text-muted)]">
      <span class="text-sm">No images</span>
    </div>
  {:else}
    <!-- Image viewport -->
    <div class="relative aspect-[16/10]">
      {#each assets as asset, i (asset.id)}
        {#if i === currentIndex}
          <div class="absolute inset-0 animate-fade-in">
            {#if asset.pendingCDN}
              <div class="flex h-full w-full items-center justify-center bg-[var(--color-surface-overlay)]">
                <div class="flex flex-col items-center gap-3">
                  <div class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]"></div>
                  <span class="text-xs text-[var(--color-text-muted)]">Uploading…</span>
                </div>
              </div>
            {:else}
              <img
                src={resolvedUrls[asset.id] ?? asset.url}
                alt="{title} — image {i + 1}"
                class="h-full w-full object-cover"
              />
            {/if}
          </div>
        {/if}
      {/each}
    </div>

    <!-- Controls -->
    {#if total > 1}
      <!-- Arrow buttons -->
      <button
        class="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface)]/70 text-[var(--color-text-primary)] backdrop-blur-sm transition-opacity {canPrev ? 'opacity-100 hover:bg-[var(--color-surface)]/90' : 'opacity-0 pointer-events-none'}"
        onclick={prev}
        aria-label="Previous image"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 2L4 7l5 5" />
        </svg>
      </button>
      <button
        class="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface)]/70 text-[var(--color-text-primary)] backdrop-blur-sm transition-opacity {canNext ? 'opacity-100 hover:bg-[var(--color-surface)]/90' : 'opacity-0 pointer-events-none'}"
        onclick={next}
        aria-label="Next image"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M5 2l5 5-5 5" />
        </svg>
      </button>

      <!-- Dots -->
      <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-[var(--color-surface)]/60 px-3 py-1.5 backdrop-blur-sm">
        {#each assets as _, i}
          <button
            class="h-1.5 rounded-full transition-all {i === currentIndex
              ? 'w-4 bg-[var(--color-text-primary)]'
              : 'w-1.5 bg-[var(--color-text-muted)] hover:bg-[var(--color-text-secondary)]'}"
            onclick={() => (currentIndex = i)}
            aria-label="Go to image {i + 1}"
          ></button>
        {/each}
      </div>
    {/if}
  {/if}
</div>
