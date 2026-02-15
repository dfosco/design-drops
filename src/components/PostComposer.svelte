<script lang="ts">
  import { isAuthenticated, authToken, currentUser } from '../lib/stores/auth';
  import { createPost, editPost, type PendingImage } from '../lib/api/dispatch';
  import { fetchRepoIds } from '../lib/api/queries';
  import { fetchRepoCollaborators, searchGitHubUsers } from '../lib/api/users';
  import { fetchAuthImage } from '../lib/api/image';
  import { config } from '../lib/config';
  import type { PostMetadata, Asset } from '../lib/types/post';
  import { editingPost } from '../lib/stores/edit';
  import AutocompleteTextarea from './AutocompleteTextarea.svelte';

  interface ImageItem {
    file: File | null;
    preview: string;
    assetId?: string;
    originalUrl?: string;
  }

  let title = $state('');
  let body = $state('');
  let team = $state('');
  let project = $state('');
  let tagInput = $state('');
  let tags: string[] = $state([]);
  let urlInput = $state('');
  let urls: string[] = $state([]);
  let dragOver = $state(false);
  let images: ImageItem[] = $state([]);
  let collaborators: string[] = $state([]);
  let collabInput = $state('');
  let collabSuggestions: string[] = $state([]);
  let showCollabDropdown = $state(false);
  let knownUsers: string[] = $state([]);

  // Edit mode
  let editMode = $state(false);
  let editDiscussionId = $state('');
  let originalAssets: Asset[] = $state([]);
  let originalMetadata: PostMetadata | null = $state(null);

  let isOpen = $state(false);
  let submitting = $state(false);
  let submitError = $state('');

  $effect(() => {
    const token = $authToken;
    if (token && knownUsers.length === 0) {
      fetchRepoCollaborators(token).then(users => { knownUsers = users; });
    }
  });

  $effect(() => {
    const q = collabInput.trim().toLowerCase();
    if (!q) { collabSuggestions = []; showCollabDropdown = false; return; }
    const local = knownUsers.filter(u => u.toLowerCase().includes(q) && !collaborators.includes(u));
    collabSuggestions = local.slice(0, 6);
    showCollabDropdown = collabSuggestions.length > 0 || q.length >= 2;
    if (local.length < 3 && q.length >= 2) {
      const token = $authToken;
      if (token) {
        searchGitHubUsers(token, q).then(results => {
          const merged = [...new Set([...local, ...results.filter(u => !collaborators.includes(u))])];
          collabSuggestions = merged.slice(0, 6);
          showCollabDropdown = merged.length > 0;
        });
      }
    }
  });

  // Open composer in edit mode when editingPost is set
  $effect(() => {
    const postToEdit = $editingPost;
    if (postToEdit) {
      editMode = true;
      editDiscussionId = postToEdit.id;
      title = postToEdit.metadata.title;
      body = postToEdit.body;
      team = postToEdit.metadata.team;
      project = postToEdit.metadata.project;
      tags = [...postToEdit.metadata.tags];
      urls = [...postToEdit.metadata.urls];
      collaborators = [...(postToEdit.metadata.collaborators ?? [])];
      originalMetadata = { ...postToEdit.metadata };
      originalAssets = [...postToEdit.metadata.assets];

      images = postToEdit.metadata.assets
        .filter(a => a.url && !a.pendingCDN)
        .map(a => ({
          file: null,
          preview: a.url,
          assetId: a.id,
          originalUrl: a.url,
        }));

      // Resolve auth image URLs for previews
      const token = $authToken;
      if (token) {
        for (const img of images) {
          if (img.originalUrl) {
            fetchAuthImage(img.originalUrl, token).then(blobUrl => {
              img.preview = blobUrl;
              images = [...images];
            });
          }
        }
      }

      isOpen = true;
      editingPost.set(null);
    }
  });

  function addCollaborator(username: string) {
    if (!collaborators.includes(username)) {
      collaborators = [...collaborators, username];
    }
    collabInput = '';
    showCollabDropdown = false;
  }

  function removeCollaborator(username: string) {
    collaborators = collaborators.filter(c => c !== username);
  }

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

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      handleFiles(dt.files);
    }
  }

  function resetForm() {
    title = '';
    body = '';
    team = '';
    project = '';
    tags = [];
    urls = [];
    images = [];
    tagInput = '';
    urlInput = '';
    submitError = '';
    collaborators = [];
    collabInput = '';
    editMode = false;
    editDiscussionId = '';
    originalAssets = [];
    originalMetadata = null;
  }

  async function handleCreateSubmit(token: string, user: { login: string }) {
    const { repositoryId, categoryId } = await fetchRepoIds(
      token,
      config.repo.owner,
      config.repo.name,
      config.discussions.category,
    );

    const localID = crypto.randomUUID();

    const pendingImages: PendingImage[] = [];
    const assets: PostMetadata['assets'] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img.file) continue;
      const ext = img.file.name.split('.').pop() ?? 'png';
      const filename = `${localID}-${i}.${ext}`;
      const assetId = `asset-${i}`;
      pendingImages.push({ id: assetId, filename, base64: img.preview });
      assets.push({ id: assetId, type: 'image', url: '', pendingCDN: true });
    }

    const metadata: PostMetadata = {
      localID,
      versionID: crypto.randomUUID(),
      authors: [user.login],
      collaborators: [...collaborators],
      title: title.trim(),
      tags: [...tags],
      team: team.trim(),
      project: project.trim(),
      urls: [...urls],
      assets,
      commentPins: [],
    };

    await createPost(token, {
      title: title.trim(),
      body: body.trim(),
      metadata,
      repositoryId,
      categoryId,
      pendingImages: pendingImages.length > 0 ? pendingImages : undefined,
    });
  }

  async function handleEditSubmit(token: string) {
    if (!originalMetadata) return;

    const keptOriginals = images.filter(img => img.originalUrl);
    const newImages = images.filter(img => img.file && !img.originalUrl);

    const originalUrls = originalAssets.filter(a => a.url && !a.pendingCDN).map(a => a.url);
    const keptUrls = keptOriginals.map(img => img.originalUrl!);
    const imagesChanged =
      keptUrls.length !== originalUrls.length ||
      !keptUrls.every(url => originalUrls.includes(url)) ||
      newImages.length > 0;

    let assets: PostMetadata['assets'];
    let pendingImages: PendingImage[] | undefined;

    if (!imagesChanged) {
      assets = [...originalAssets];
    } else {
      assets = keptOriginals.map((img, i) => ({
        id: img.assetId || `asset-kept-${i}`,
        type: 'image' as const,
        url: img.originalUrl!,
        pendingCDN: false,
      }));

      const editId = crypto.randomUUID();
      pendingImages = [];
      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i];
        if (!img.file) continue;
        const ext = img.file.name.split('.').pop() ?? 'png';
        const filename = `${editId}-${i}.${ext}`;
        const assetId = `asset-new-${i}`;
        pendingImages.push({ id: assetId, filename, base64: img.preview });
        assets.push({ id: assetId, type: 'image', url: '', pendingCDN: true });
      }
      if (pendingImages.length === 0) pendingImages = undefined;
    }

    const updatedMetadata: PostMetadata = {
      ...originalMetadata,
      title: title.trim(),
      tags: [...tags],
      team: team.trim(),
      project: project.trim(),
      urls: [...urls],
      collaborators: [...collaborators],
      assets,
      versionID: crypto.randomUUID(),
    };

    await editPost(token, {
      discussionId: editDiscussionId,
      body: body.trim(),
      metadata: updatedMetadata,
      pendingImages,
    });
  }

  async function handleSubmit() {
    const token = $authToken;
    const user = $currentUser;
    if (!token || !user) return;

    submitting = true;
    submitError = '';
    const wasEditMode = editMode;

    try {
      if (editMode) {
        await handleEditSubmit(token);
      } else {
        await handleCreateSubmit(token, user);
      }

      resetForm();
      isOpen = false;
      if (wasEditMode) {
        window.location.reload();
      }
    } catch (err) {
      submitError = err instanceof Error ? err.message : wasEditMode ? 'Failed to save changes.' : 'Failed to create post.';
    } finally {
      submitting = false;
    }
  }

  const canSubmit = $derived(title.trim().length > 0 && !submitting);
</script>

<!-- Trigger button (auth-gated) -->
{#if $isAuthenticated}
<button
  class="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-surface hover:bg-accent-hover transition-colors"
  onclick={() => (isOpen = true)}
>
  New Drop
</button>
{/if}

<!-- Modal overlay -->
{#if isOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-surface/80 backdrop-blur-sm animate-fade-in pt-20 pb-8"
    onkeydown={(e) => { if (e.key === 'Escape') { resetForm(); isOpen = false; } }}
    onclick={(e) => { if (e.target === e.currentTarget) { resetForm(); isOpen = false; } }}
    onpaste={handlePaste}
  >
    <div
      class="relative w-full max-w-2xl rounded-2xl border border-border bg-surface-raised shadow-2xl animate-fade-up"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-border-subtle px-6 py-4">
        <h2 class="font-heading text-xl text-text-primary">{editMode ? 'Edit Drop' : 'New Drop'}</h2>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-overlay hover:text-text-primary transition-colors"
          onclick={() => { resetForm(); isOpen = false; }}
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
            class="w-full border-none bg-transparent font-heading text-2xl text-text-primary placeholder:text-text-muted/50 focus:outline-none"
          />
        </div>

        <!-- Body -->
        <div>
          <AutocompleteTextarea
            bind:value={body}
            placeholder="Describe your work — context, decisions, questions…"
            rows={4}
            projects={config.discussions.projects ?? []}
            class="w-full resize-none border-none bg-transparent text-sm leading-relaxed text-text-secondary placeholder:text-text-muted/50 focus:outline-none"
          />
        </div>

        <!-- Image upload -->
        <div>
          <label class="mb-2 block text-sm font-medium uppercase tracking-widest text-text-muted">
            Images
          </label>

          <!-- Drop zone -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="relative rounded-xl border-2 border-dashed transition-colors {dragOver
              ? 'border-accent bg-accent/5'
              : 'border-border hover:border-text-muted'}"
            ondragover={(e) => { e.preventDefault(); dragOver = true; }}
            ondragleave={() => (dragOver = false)}
            ondrop={handleDrop}
          >
            {#if images.length === 0}
              <div class="flex flex-col items-center justify-center py-10 text-center">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" class="mb-3 text-text-muted">
                  <rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" stroke-width="1.5" />
                  <circle cx="12" cy="14" r="2.5" stroke="currentColor" stroke-width="1.5" />
                  <path d="M4 22l6-6 4 4 6-8 8 10" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                </svg>
                <p class="text-sm text-text-muted">Drop or paste images here, or</p>
                <label class="mt-1 cursor-pointer text-sm text-accent hover:text-accent-hover transition-colors">
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
                      class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface/80 text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      onclick={() => removeImage(i)}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M2 2l6 6M8 2l-6 6" />
                      </svg>
                    </button>
                  </div>
                {/each}
                <label class="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-text-muted hover:border-text-muted hover:text-text-secondary transition-colors">
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
            <label class="mb-2 block text-sm font-medium uppercase tracking-widest text-text-muted">
              Team
            </label>
            <input
              type="text"
              placeholder="e.g. Growth"
              bind:value={team}
              class="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium uppercase tracking-widest text-text-muted">
              Project
            </label>
            <input
              type="text"
              placeholder="e.g. Onboarding Redesign"
              bind:value={project}
              class="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent focus:outline-none transition-colors"
            />
          </div>
        </div>

        <!-- Collaborators -->
        <div>
          <label class="mb-2 block text-sm font-medium uppercase tracking-widest text-text-muted">
            Collaborators
          </label>
          <div class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-overlay px-3 py-2">
            {#each collaborators as collab}
              <span class="flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-sm text-text-secondary">
                <img src={`https://github.com/${collab}.png`} alt={collab} class="h-4 w-4 rounded-full object-cover" />
                {collab}
                <button class="ml-0.5 text-text-muted hover:text-text-primary" onclick={() => removeCollaborator(collab)}>×</button>
              </span>
            {/each}
            <div class="relative flex-1">
              <input type="text" placeholder={collaborators.length === 0 ? '@username' : ''} bind:value={collabInput}
                onfocus={() => { if (collabInput.trim()) showCollabDropdown = true; }}
                class="w-full min-w-[80px] border-none bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none" />
              {#if showCollabDropdown && collabSuggestions.length > 0}
                <div class="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-border bg-surface-raised p-1 shadow-xl">
                  {#each collabSuggestions as suggestion}
                    <button class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
                      onclick={() => addCollaborator(suggestion)}>
                      <img src={`https://github.com/${suggestion}.png`} alt={suggestion} class="h-5 w-5 rounded-full object-cover" />
                      {suggestion}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div>
          <label class="mb-2 block text-sm font-medium uppercase tracking-widest text-text-muted">
            Tags
          </label>
          <div class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-overlay px-3 py-2">
            {#each tags as tag}
              <span class="flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-sm text-text-secondary">
                {tag}
                <button
                  class="ml-0.5 text-text-muted hover:text-text-primary"
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
              class="min-w-[80px] flex-1 border-none bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
          </div>
        </div>

        <!-- External URLs -->
        <div>
          <label class="mb-2 block text-sm font-medium uppercase tracking-widest text-text-muted">
            Links
          </label>
          {#each urls as url, i}
            <div class="mb-2 flex items-center gap-2">
              <div class="flex-1 truncate rounded-lg bg-surface-overlay px-3 py-2 text-sm text-text-secondary">
                {url}
              </div>
              <button
                class="text-text-muted hover:text-text-primary"
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
              class="flex-1 rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent focus:outline-none transition-colors"
            />
            <button
              class="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:border-text-muted transition-colors"
              onclick={addUrl}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-border-subtle px-6 py-4">
        {#if submitError}
          <p class="mb-3 text-sm text-red-400">{submitError}</p>
        {/if}
        <div class="flex items-center justify-end gap-3">
          <button
            class="rounded-full px-5 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
            onclick={() => { resetForm(); isOpen = false; }}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            class="rounded-full px-6 py-2 text-sm font-semibold transition-colors {canSubmit
              ? 'bg-accent text-surface hover:bg-accent-hover'
              : 'bg-surface-overlay text-text-muted cursor-not-allowed'}"
            disabled={!canSubmit}
            onclick={handleSubmit}
          >
            {#if submitting}
              <span class="inline-flex items-center gap-2">
                <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                {editMode ? 'Saving…' : 'Posting…'}
              </span>
            {:else}
              {editMode ? 'Save Changes' : 'Post Drop'}
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
