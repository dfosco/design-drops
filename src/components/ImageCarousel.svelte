<script lang="ts">
  import type { Asset } from '../lib/types/post';
  import { authToken } from '../lib/stores/auth';
  import { fetchAuthImage } from '../lib/api/image';

  let { assets = [], title = '' }: { assets?: Asset[]; title?: string } = $props();

  let currentIndex = $state(0);
  let resolvedUrls: Record<string, string> = $state({});
  let lightboxOpen = $state(false);
  let lightboxEl: HTMLDivElement | undefined = $state();

  // Portal lightbox to document.body so ancestor stacking contexts can't clip it
  $effect(() => {
    if (lightboxEl) {
      document.body.appendChild(lightboxEl);
      return () => { lightboxEl?.remove(); };
    }
  });

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
    if (lightboxOpen) {
      if (e.key === 'Escape') lightboxOpen = false;
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    } else {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
  }

  function openLightbox() {
    if (assets.length > 0 && !assets[currentIndex]?.pendingCDN) {
      lightboxOpen = true;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative overflow-hidden rounded-xl bg-surface-overlay">
  {#if assets.length === 0}
    <div class="flex aspect-[16/10] items-center justify-center text-text-muted">
      <span class="text-sm">No images</span>
    </div>
  {:else}
    <!-- Image viewport -->
    <div class="relative aspect-[16/10]">
      {#each assets as asset, i (asset.id)}
        {#if i === currentIndex}
          <div class="absolute inset-0 animate-fade-in">
            {#if asset.pendingCDN}
              <div class="flex h-full w-full items-center justify-center bg-surface-overlay">
                <div class="flex flex-col items-center gap-3">
                  <div class="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent"></div>
                  <span class="text-sm text-text-muted">Uploading…</span>
                </div>
              </div>
            {:else}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <img
                src={resolvedUrls[asset.id] ?? asset.url}
                alt="{title} — image {i + 1}"
                class="h-full w-full object-cover cursor-zoom-in"
                onclick={openLightbox}
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
        class="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-surface/70 text-text-primary backdrop-blur-sm transition-opacity {canPrev ? 'opacity-100 hover:bg-surface/90' : 'opacity-0 pointer-events-none'}"
        onclick={prev}
        aria-label="Previous image"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 2L4 7l5 5" />
        </svg>
      </button>
      <button
        class="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-surface/70 text-text-primary backdrop-blur-sm transition-opacity {canNext ? 'opacity-100 hover:bg-surface/90' : 'opacity-0 pointer-events-none'}"
        onclick={next}
        aria-label="Next image"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M5 2l5 5-5 5" />
        </svg>
      </button>

      <!-- Dots -->
      <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-surface/60 px-3 py-1.5 backdrop-blur-sm">
        {#each assets as _, i}
          <button
            class="h-1.5 rounded-full transition-all {i === currentIndex
              ? 'w-4 bg-text-primary'
              : 'w-1.5 bg-text-muted hover:bg-text-secondary'}"
            onclick={() => (currentIndex = i)}
            aria-label="Go to image {i + 1}"
          ></button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- Lightbox modal — portaled to document.body via $effect -->
<div bind:this={lightboxEl} class:hidden={!lightboxOpen}>
  {#if lightboxOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in"
      onclick={(e) => e.target === e.currentTarget && (lightboxOpen = false)}
    >
      <!-- Close button -->
      <button
        class="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
        onclick={() => (lightboxOpen = false)}
        aria-label="Close lightbox"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 4l10 10M14 4L4 14" />
        </svg>
      </button>

      <!-- Counter -->
      {#if total > 1}
        <div class="absolute top-5 left-1/2 -translate-x-1/2 text-sm text-white/50">
          {currentIndex + 1} / {total}
        </div>
      {/if}

      <!-- Image -->
      {#each assets as asset, i (asset.id)}
        {#if i === currentIndex && !asset.pendingCDN}
          <img
            src={resolvedUrls[asset.id] ?? asset.url}
            alt="{title} — image {i + 1}"
            class="max-h-[90vh] max-w-[90vw] object-contain rounded-lg animate-fade-in"
          />
        {/if}
      {/each}

      <!-- Lightbox navigation arrows -->
      {#if total > 1}
        <button
          class="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-opacity hover:bg-white/20 hover:text-white {canPrev ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
          onclick={prev}
          aria-label="Previous image"
        >
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 2L4 7l5 5" />
          </svg>
        </button>
        <button
          class="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-opacity hover:bg-white/20 hover:text-white {canNext ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
          onclick={next}
          aria-label="Next image"
        >
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M5 2l5 5-5 5" />
          </svg>
        </button>
      {/if}
    </div>
  {/if}
</div>
