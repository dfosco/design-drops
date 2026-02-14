<script lang="ts">
  import type { Post } from '../lib/types/post';
  import ImageCarousel from './ImageCarousel.svelte';
  import { MOCK_POSTS } from '../lib/mock-data';
  import { config } from '../lib/config';
  import { auth, authToken, currentUser } from '../lib/stores/auth';
  import { fetchPostBySlug, fetchPost, fetchRepoIds } from '../lib/api/queries';
  import { AuthError } from '../lib/api/graphql';
  import { deletePost, editPost, addComment, deleteComment, replyToComment } from '../lib/api/dispatch';
  import { slugify } from '../lib/slug';

  let post: Post | null = $state(null);
  let loading = $state(true);
  let showDeleteConfirm = $state(false);
  let deleting = $state(false);
  let deleteError = $state('');
  let commentText = $state('');
  let submittingComment = $state(false);
  let commentError = $state('');
  let replyingTo: string | null = $state(null);
  let replyingToUser = $state('');
  let replyText = $state('');
  let submittingReply = $state(false);

  // Edit mode state
  let editing = $state(false);
  let editTitle = $state('');
  let editBody = $state('');
  let editTeam = $state('');
  let editProject = $state('');
  let editTags: string[] = $state([]);
  let editTagInput = $state('');
  let editUrls: string[] = $state([]);
  let editUrlInput = $state('');
  let saving = $state(false);
  let editError = $state('');

  const isAuthor = $derived(
    !!$currentUser?.login && (
      !!post?.metadata.authors?.includes($currentUser.login) ||
      !!(post?.metadata.collaborators ?? []).includes($currentUser.login)
    )
  );

  async function handleDelete() {
    const token = $authToken;
    if (!token || !post) return;
    deleting = true;
    deleteError = '';
    try {
      await deletePost(token, post.id);
      window.location.href = `${config.site.basePath}/`;
    } catch (err: any) {
      deleteError = err?.message ?? 'Failed to delete post';
      deleting = false;
    }
  }

  /** Extract slug from pathname, e.g. /design-drops/post/my-title → my-title */
  function getSlugFromPath(): string | null {
    const prefix = `${config.site.basePath}/post/`;
    const path = window.location.pathname;
    if (!path.startsWith(prefix)) return null;
    const slug = path.slice(prefix.length).replace(/\/+$/, '');
    return slug || null;
  }

  async function refetchPost() {
    const token = $authToken;
    if (!token) return;

    if (post) {
      const updated = await fetchPost(token, post.id);
      if (updated) {
        post = updated;
        return;
      }
    }

    const slug = getSlugFromPath();
    if (!slug) return;

    loading = true;
    fetchRepoIds(token, config.repo.owner, config.repo.name, config.discussions.category)
      .then(({ categoryId }) =>
        fetchPostBySlug(token, config.repo.owner, config.repo.name, categoryId, slug)
      )
      .then((fetched) => {
        post = fetched;
        loading = false;
      })
      .catch((err) => {
        if (err instanceof AuthError) {
          auth.logout();
          return;
        }
        loading = false;
      });
  }

  function startEditing() {
    if (!post) return;
    editTitle = post.metadata.title;
    editBody = post.body;
    editTeam = post.metadata.team;
    editProject = post.metadata.project;
    editTags = [...post.metadata.tags];
    editUrls = [...post.metadata.urls];
    editing = true;
    editError = '';
  }

  function cancelEditing() {
    editing = false;
    editError = '';
  }

  function addEditTag() {
    const tag = editTagInput.trim();
    if (tag && !editTags.includes(tag)) {
      editTags = [...editTags, tag];
    }
    editTagInput = '';
  }

  function removeEditTag(tag: string) {
    editTags = editTags.filter((t) => t !== tag);
  }

  function addEditUrl() {
    const url = editUrlInput.trim();
    if (url) {
      editUrls = [...editUrls, url];
    }
    editUrlInput = '';
  }

  function removeEditUrl(url: string) {
    editUrls = editUrls.filter((u) => u !== url);
  }

  async function handleSave() {
    const token = $authToken;
    if (!token || !post) return;

    saving = true;
    editError = '';

    try {
      const updatedMetadata = {
        ...post.metadata,
        title: editTitle.trim(),
        tags: editTags,
        team: editTeam.trim(),
        project: editProject.trim(),
        urls: editUrls,
        versionID: crypto.randomUUID(),
      };

      await editPost(token, {
        discussionId: post.id,
        body: editBody.trim(),
        metadata: updatedMetadata,
      });

      editing = false;
      refetchPost();
    } catch (err) {
      editError = err instanceof Error ? err.message : 'Failed to save changes';
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    const slug = getSlugFromPath();
    if (!slug) {
      loading = false;
      return;
    }

    if (config.features.mockPosts) {
      post = MOCK_POSTS.find((p) => slugify(p.metadata.title) === slug) ?? null;
      loading = false;
      return;
    }

    const token = $authToken;
    if (!token) {
      loading = false;
      return;
    }

    loading = true;
    fetchRepoIds(token, config.repo.owner, config.repo.name, config.discussions.category)
      .then(({ categoryId }) =>
        fetchPostBySlug(token, config.repo.owner, config.repo.name, categoryId, slug)
      )
      .then((fetched) => {
        post = fetched;
        loading = false;
      })
      .catch((err) => {
        if (err instanceof AuthError) {
          auth.logout();
          return;
        }
        loading = false;
      });
  });

  const timeAgo = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  async function handleAddComment() {
    const token = $authToken;
    if (!token || !post || !commentText.trim()) return;
    commentError = '';
    submittingComment = true;
    try {
      await addComment(token, post.id, commentText.trim());
      commentText = '';
      await refetchPost();
    } catch (err: any) {
      commentError = err.message || 'Failed to add comment';
    } finally {
      submittingComment = false;
    }
  }

  async function handleDeleteComment(commentId: string) {
    const token = $authToken;
    if (!token) return;
    try {
      await deleteComment(token, commentId);
      await refetchPost();
    } catch (err: any) {
      commentError = err.message || 'Failed to delete comment';
    }
  }

  function startReply(commentId: string, username: string) {
    replyingTo = commentId;
    replyingToUser = username;
    replyText = '';
  }

  async function handleReply(parentCommentId: string) {
    const token = $authToken;
    if (!token || !post || !replyText.trim()) return;
    submittingReply = true;
    try {
      await replyToComment(token, post.id, parentCommentId, replyText.trim());
      replyText = '';
      replyingTo = null;
      await refetchPost();
    } catch (err: any) {
      commentError = err.message || 'Failed to post reply';
    } finally {
      submittingReply = false;
    }
  }
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
      {#if editing}
        <div class="mb-3 flex items-center gap-2 text-sm">
          <input type="text" bind:value={editTeam} placeholder="Team" class="w-24 border-none bg-transparent text-[var(--color-text-muted)] focus:outline-none" />
          <span class="opacity-40">·</span>
          <input type="text" bind:value={editProject} placeholder="Project" class="w-32 border-none bg-transparent text-[var(--color-text-muted)] focus:outline-none" />
        </div>
      {:else}
        <div class="mb-3 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <span>{post.metadata.team}</span>
          {#if post.metadata.project}
            <span class="opacity-40">·</span>
            <span>{post.metadata.project}</span>
          {/if}
          <span class="opacity-40">·</span>
          <span>{timeAgo(post.createdAt)}</span>
        </div>
      {/if}

      {#if editing}
        <input type="text" bind:value={editTitle} class="mb-4 w-full border-none bg-transparent font-[var(--font-display)] text-4xl font-bold leading-tight tracking-tight text-[var(--color-text-primary)] focus:outline-none md:text-5xl" />
      {:else}
        <h1 class="mb-4 font-[var(--font-display)] text-4xl font-bold leading-tight tracking-tight text-[var(--color-text-primary)] md:text-5xl">
          {post.metadata.title}
        </h1>
      {/if}

      <!-- Authors -->
      <div class="flex items-center gap-3">
        <div class="flex -space-x-2">
          {#each post.metadata.authors as author}
            <img src={`https://github.com/${author}.png`} alt={author} class="h-8 w-8 rounded-full border-2 border-[var(--color-surface)] object-cover" loading="lazy" />
          {/each}
        </div>
        <span class="text-sm text-[var(--color-text-secondary)]">
          {post.metadata.authors.join(' & ')}
        </span>
        {#if post.metadata.collaborators && post.metadata.collaborators.length > 0}
          <span class="text-sm text-[var(--color-text-muted)]">with</span>
          <div class="flex -space-x-1.5">
            {#each post.metadata.collaborators as collab}
              <img src={`https://github.com/${collab}.png`} alt={collab} class="h-7 w-7 rounded-full border-2 border-[var(--color-surface)] object-cover" loading="lazy" />
            {/each}
          </div>
          <span class="text-sm text-[var(--color-text-muted)]">
            {post.metadata.collaborators.join(', ')}
          </span>
        {/if}
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
      {#if editing}
        <textarea bind:value={editBody} rows="4" class="w-full resize-none border-none bg-transparent text-lg leading-relaxed text-[var(--color-text-secondary)] focus:outline-none"></textarea>
      {:else}
        <p class="max-w-2xl text-lg leading-relaxed text-[var(--color-text-secondary)]">
          {post.body}
        </p>
      {/if}
    </div>

    <!-- External URLs -->
    {#if editing}
      <div class="mb-10 animate-fade-up" style="animation-delay: 240ms">
        <h3 class="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Links</h3>
        <div class="space-y-2">
          {#each editUrls as url}
            <div class="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              <span class="flex-1 truncate">{url.replace(/^https?:\/\//, '')}</span>
              <button class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" onclick={() => removeEditUrl(url)}>×</button>
            </div>
          {/each}
          <div class="flex items-center gap-2">
            <input type="text" placeholder="Add a URL…" bind:value={editUrlInput}
              onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditUrl(); } }}
              class="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none" />
            <button onclick={addEditUrl} class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Add</button>
          </div>
        </div>
      </div>
    {:else if post.metadata.urls.length > 0}
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
    {#if editing}
      <div class="mb-10 animate-fade-up" style="animation-delay: 300ms">
        <h3 class="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Tags</h3>
        <div class="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-3 py-2">
          {#each editTags as tag}
            <span class="flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
              {tag}
              <button class="ml-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" onclick={() => removeEditTag(tag)}>×</button>
            </span>
          {/each}
          <input type="text" placeholder={editTags.length === 0 ? 'Add tags…' : ''} bind:value={editTagInput}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEditTag(); } }}
            class="min-w-[80px] flex-1 border-none bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none" />
        </div>
      </div>
    {:else if post.metadata.tags.length > 0}
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
    {#if editing}
      <div class="flex items-center gap-3 border-t border-[var(--color-border-subtle)] pt-6 animate-fade-up" style="animation-delay: 360ms">
        {#if editError}
          <p class="text-xs text-red-400 mr-auto">{editError}</p>
        {/if}
        <div class="flex items-center gap-3 ml-auto">
          <button onclick={cancelEditing} disabled={saving}
            class="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
            Cancel
          </button>
          <button onclick={handleSave} disabled={saving || !editTitle.trim()}
            class="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50">
            {#if saving}
              <span class="inline-flex items-center gap-2">
                <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                Saving…
              </span>
            {:else}
              Save changes
            {/if}
          </button>
        </div>
      </div>
    {:else if isAuthor}
    <div class="flex items-center gap-3 border-t border-[var(--color-border-subtle)] pt-6 animate-fade-up" style="animation-delay: 360ms">
      <button
        class="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        onclick={() => startEditing()}
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
            {#if deleteError}
              <p class="mb-3 text-sm text-red-400">{deleteError}</p>
            {/if}
            <div class="flex gap-2">
              <button
                class="rounded-full bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onclick={handleDelete}
                disabled={deleting}
              >
                {#if deleting}
                  <span class="inline-flex items-center gap-1.5">
                    <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-75" />
                    </svg>
                    Deleting…
                  </span>
                {:else}
                  Yes, delete
                {/if}
              </button>
              <button
                class="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                onclick={() => (showDeleteConfirm = false)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
    {/if}

    <!-- Comments -->
    {#if config.features.comments}
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
            bind:value={commentText}
            placeholder="Add a comment…"
            rows="3"
            disabled={submittingComment}
            class="w-full resize-none bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none disabled:opacity-50"
          ></textarea>
          {#if commentError}
            <p class="mt-2 text-xs text-red-400">{commentError}</p>
          {/if}
          <div class="mt-3 flex justify-end">
            <button
              class="rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submittingComment || !commentText.trim()}
              onclick={handleAddComment}
            >
              {submittingComment ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>

        <!-- Comment list -->
        <div class="space-y-6">
          {#if post.comments && post.comments.length > 0}
            {#each post.comments as comment}
              <div class="flex gap-3">
                <img src={`https://github.com/${comment.author.login}.png`} alt={comment.author.login} class="h-8 w-8 shrink-0 rounded-full object-cover" loading="lazy" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-[var(--color-text-primary)]">{comment.author.login}</span>
                    <span class="text-xs text-[var(--color-text-muted)]">{timeAgo(comment.createdAt)}</span>
                    <button class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                      onclick={() => startReply(comment.id, comment.author.login)}>
                      Reply
                    </button>
                    {#if $currentUser?.login === comment.author.login}
                      <button
                        class="ml-auto text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                        onclick={() => handleDeleteComment(comment.id)}
                      >
                        Delete
                      </button>
                    {/if}
                  </div>
                  <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{comment.body}</p>

                  {#if comment.replies && comment.replies.length > 0}
                    <div class="mt-3 space-y-3 border-l-2 border-[var(--color-border-subtle)] pl-4">
                      {#each comment.replies as reply}
                        <div class="flex gap-2.5">
                          <img src={`https://github.com/${reply.author.login}.png`} alt={reply.author.login} class="h-6 w-6 shrink-0 rounded-full object-cover" loading="lazy" />
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                              <span class="text-sm font-medium text-[var(--color-text-primary)]">{reply.author.login}</span>
                              <span class="text-xs text-[var(--color-text-muted)]">{timeAgo(reply.createdAt)}</span>
                              {#if $currentUser?.login === reply.author.login}
                                <button class="ml-auto text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                                  onclick={() => handleDeleteComment(reply.id)}>Delete</button>
                              {/if}
                            </div>
                            <p class="mt-0.5 text-sm text-[var(--color-text-secondary)]">{reply.body}</p>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  {#if replyingTo === comment.id}
                    <div class="mt-3 flex gap-2.5">
                      <textarea bind:value={replyText} placeholder={`Reply to ${replyingToUser}…`} rows="2"
                        class="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"></textarea>
                      <div class="flex flex-col gap-1.5">
                        <button onclick={() => handleReply(comment.id)} disabled={submittingReply || !replyText.trim()}
                          class="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-surface)] hover:opacity-90 disabled:opacity-50 transition-opacity">
                          {submittingReply ? '…' : 'Reply'}
                        </button>
                        <button onclick={() => { replyingTo = null; replyText = ''; }}
                          class="rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          {:else}
            <p class="text-center text-sm text-[var(--color-text-muted)]">
              No comments yet
            </p>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>
