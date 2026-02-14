<script lang="ts">
  import { isAuthenticated } from '../lib/stores/auth';

  let title = $state('');
  let body = $state('');
  let team = $state('');
  let project = $state('');
  let tagInput = $state('');
  let tags: string[] = $state([]);
  let urlInput = $state('');
  let urls: string[] = $state([]);
  let dragOver = $state(false);
  let images: { file: File; preview: string }[] = $state([]);

  let isOpen = $state(false);

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      tags = [...tags, t];
      tagInput = '';
    }
  }

  function removeTag(tag: string) {
    tags = tags.filter((t) => t !== tag);
  }

  function addUrl() {
    const u = urlInput.trim();
    if (u) {
      urls = [...urls, u];
      urlInput = '';
    }
  }

  function removeUrl(url: string) {
    urls = urls.filter((u) => u !== url);
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    for (const file of fileList) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          images = [...images, { file, preview: e.target?.result as string }];
        };
        reader.readAsDataURL(file);
      }
    }
  }

  function removeImage(index: number) {
    images = images.filter((_, i) => i !== index);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    handleFiles(e.dataTransfer?.files ?? null);
  }

  function handleSubmit() {
    // Will be wired up later
    console.log('Submit:', { title, body, team, project, tags, urls, images: images.length });
  }

  const canSubmit = $derived(title.trim().length > 0);
</script>

<!-- Trigger button (auth-gated) -->
{#if $isAuthenticated}
<button
  class="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-accent-hover)] transition-colors"
  onclick={() => (isOpen = true)}
>
  New Drop
</button>
{/if}

<!-- Modal overlay -->
{#if isOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--color-surface)]/80 backdrop-blur-sm animate-fade-in"
    onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}
    onclick={(e) => { if (e.target === e.currentTarget) isOpen = false; }}
  >
    <div
      class="relative my-12 w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-2xl animate-fade-up"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-6 py-4">
        <h2 class="font-[var(--font-display)] text-xl text-[var(--color-text-primary)]">New Drop</h2>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)] transition-colors"
          onclick={() => (isOpen = false)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <!-- Form -->
      <div class="p-6 space-y-6">
        <!-- Title -->
        <div>
          <input
            type="text"
            placeholder="Give your drop a title"
            bind:value={title}
            class="w-full border-none bg-transparent font-[var(--font-display)] text-2xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none"
          />
        </div>

        <!-- Body -->
        <div>
          <textarea
            placeholder="Describe your work — context, decisions, questions…"
            bind:value={body}
            rows="4"
            class="w-full resize-none border-none bg-transparent text-sm leading-relaxed text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none"
          ></textarea>
        </div>

        <!-- Image upload -->
        <div>
          <label class="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
            Images
          </label>

          <!-- Drop zone -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="relative rounded-xl border-2 border-dashed transition-colors {dragOver
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
              : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'}"
            ondragover={(e) => { e.preventDefault(); dragOver = true; }}
            ondragleave={() => (dragOver = false)}
            ondrop={handleDrop}
          >
            {#if images.length === 0}
              <div class="flex flex-col items-center justify-center py-10 text-center">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" class="mb-3 text-[var(--color-text-muted)]">
                  <rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" stroke-width="1.5" />
                  <circle cx="12" cy="14" r="2.5" stroke="currentColor" stroke-width="1.5" />
                  <path d="M4 22l6-6 4 4 6-8 8 10" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                </svg>
                <p class="text-sm text-[var(--color-text-muted)]">Drop images here or</p>
                <label class="mt-1 cursor-pointer text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors">
                  browse files
                  <input type="file" accept="image/*" multiple class="hidden" onchange={(e) => handleFiles((e.target as HTMLInputElement).files)} />
                </label>
              </div>
            {:else}
              <div class="grid grid-cols-3 gap-2 p-3">
                {#each images as image, i}
                  <div class="group relative aspect-square overflow-hidden rounded-lg">
                    <img src={image.preview} alt="Upload preview" class="h-full w-full object-cover" />
                    <button
                      class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface)]/80 text-[var(--color-text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                      onclick={() => removeImage(i)}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M2 2l6 6M8 2l-6 6" />
                      </svg>
                    </button>
                  </div>
                {/each}
                <label class="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                  <input type="file" accept="image/*" multiple class="hidden" onchange={(e) => handleFiles((e.target as HTMLInputElement).files)} />
                </label>
              </div>
            {/if}
          </div>
        </div>

        <!-- Team & Project row -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              Team
            </label>
            <input
              type="text"
              placeholder="e.g. Growth"
              bind:value={team}
              class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:border-[var(--color-accent)] focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label class="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
              Project
            </label>
            <input
              type="text"
              placeholder="e.g. Onboarding Redesign"
              bind:value={project}
              class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:border-[var(--color-accent)] focus:outline-none transition-colors"
            />
          </div>
        </div>

        <!-- Tags -->
        <div>
          <label class="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
            Tags
          </label>
          <div class="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-3 py-2">
            {#each tags as tag}
              <span class="flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
                {tag}
                <button
                  class="ml-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  onclick={() => removeTag(tag)}
                >×</button>
              </span>
            {/each}
            <input
              type="text"
              placeholder={tags.length === 0 ? 'Add tags…' : ''}
              bind:value={tagInput}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                }
              }}
              class="min-w-[80px] flex-1 border-none bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none"
            />
          </div>
        </div>

        <!-- External URLs -->
        <div>
          <label class="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
            Links
          </label>
          {#each urls as url, i}
            <div class="mb-2 flex items-center gap-2">
              <div class="flex-1 truncate rounded-lg bg-[var(--color-surface-overlay)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                {url}
              </div>
              <button
                class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                onclick={() => removeUrl(url)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 4l6 6M10 4l-6 6" />
                </svg>
              </button>
            </div>
          {/each}
          <div class="flex gap-2">
            <input
              type="url"
              placeholder="https://figma.com/…"
              bind:value={urlInput}
              onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
              class="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:border-[var(--color-accent)] focus:outline-none transition-colors"
            />
            <button
              class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] transition-colors"
              onclick={addUrl}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 border-t border-[var(--color-border-subtle)] px-6 py-4">
        <button
          class="rounded-full px-5 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          onclick={() => (isOpen = false)}
        >
          Cancel
        </button>
        <button
          class="rounded-full px-6 py-2 text-sm font-semibold transition-colors {canSubmit
            ? 'bg-[var(--color-accent)] text-[var(--color-surface)] hover:bg-[var(--color-accent-hover)]'
            : 'bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] cursor-not-allowed'}"
          disabled={!canSubmit}
          onclick={handleSubmit}
        >
          Post Drop
        </button>
      </div>
    </div>
  </div>
{/if}
