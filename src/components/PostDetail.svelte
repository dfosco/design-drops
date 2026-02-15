<script lang="ts">
  import type { Post, Comment, ReactionContent } from '../lib/types/post';
  import ImageCarousel from './ImageCarousel.svelte';
  import { MOCK_POSTS } from '../lib/mock-data';
  import { config } from '../lib/config';
  import { auth, authToken, currentUser } from '../lib/stores/auth';
  import { editingPost } from '../lib/stores/edit';
  import { fetchPostByNumber, fetchPost } from '../lib/api/queries';
  import { AuthError } from '../lib/api/graphql';
  import { deletePost, addComment, deleteComment, replyToComment, addReaction, removeReaction } from '../lib/api/dispatch';
  import { slugify } from '../lib/slug';
  import RichText from './RichText.svelte';
  import AutocompleteTextarea from './AutocompleteTextarea.svelte';

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

  const REACTION_EMOJI: Record<string, string> = {
    THUMBS_UP: '👍',
    THUMBS_DOWN: '👎',
    LAUGH: '😄',
    HOORAY: '🎉',
    CONFUSED: '😕',
    HEART: '❤️',
    ROCKET: '🚀',
    EYES: '👀',
  };

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

  /** Extract discussion number and slug from pathname, e.g. /post/43/my-title */
  function getPostInfoFromPath(): { number: number; slug: string } | null {
    const prefix = `${config.site.basePath}/post/`;
    const path = window.location.pathname;
    if (!path.startsWith(prefix)) return null;
    const rest = path.slice(prefix.length).replace(/\/+$/, '');
    if (!rest) return null;
    // Format: {number}/{slug}
    const slashIndex = rest.indexOf('/');
    if (slashIndex === -1) {
      // Backwards compat: might be just a number
      const num = parseInt(rest, 10);
      if (!isNaN(num)) return { number: num, slug: '' };
      return null;
    }
    const num = parseInt(rest.slice(0, slashIndex), 10);
    if (isNaN(num)) return null;
    return { number: num, slug: rest.slice(slashIndex + 1) };
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

    const info = getPostInfoFromPath();
    if (!info) return;

    loading = true;
    fetchPostByNumber(token, config.repo.owner, config.repo.name, info.number)
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
    if (post) editingPost.set(post);
  }

  $effect(() => {
    const info = getPostInfoFromPath();
    if (!info) {
      loading = false;
      return;
    }

    if (config.features.mockPosts) {
      post = MOCK_POSTS.find((p) => p.number === info.number) ?? null;
      loading = false;
      return;
    }

    const token = $authToken;
    if (!token) {
      loading = false;
      return;
    }

    loading = true;
    fetchPostByNumber(token, config.repo.owner, config.repo.name, info.number)
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

  async function toggleReaction(target: Post | Comment, content: string) {
    const token = $authToken;
    if (!token) return;

    const existingGroup = target.reactions?.find(r => r.content === content);
    const wasReacted = existingGroup?.viewerHasReacted ?? false;

    // Optimistic update
    if (wasReacted) {
      if (existingGroup) {
        existingGroup.totalCount = Math.max(0, existingGroup.totalCount - 1);
        existingGroup.viewerHasReacted = false;
      }
      target.reactions = target.reactions?.filter(r => r.totalCount > 0) ?? [];
    } else {
      if (existingGroup) {
        existingGroup.totalCount++;
        existingGroup.viewerHasReacted = true;
      } else {
        target.reactions = [...(target.reactions ?? []), { content: content as ReactionContent, totalCount: 1, viewerHasReacted: true }];
      }
    }
    post = post; // trigger reactivity

    try {
      if (wasReacted) {
        await removeReaction(token, target.id, content);
      } else {
        await addReaction(token, target.id, content);
      }
    } catch (err) {
      console.error('Reaction toggle failed:', err);
    }
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

<div class="mx-auto max-w-4xl px-[var(--spacing-page)] pt-10 pb-20">
  {#if loading}
    <!-- Loading skeleton -->
    <div class="animate-pulse">
      <div class="mb-4 h-4 w-32 rounded bg-surface-overlay"></div>
      <div class="mb-6 h-10 w-3/4 rounded bg-surface-overlay"></div>
      <div class="aspect-[16/10] rounded-xl bg-surface-overlay"></div>
    </div>
  {:else if !post}
    <!-- Not found -->
    <div class="flex flex-col items-center justify-center py-32 text-center animate-fade-up">
      <div class="mb-4 text-6xl opacity-20">✦</div>
      <p class="text-xl text-text-muted">Post not found</p>
      <a
        href={`${config.site.basePath}/`}
        class="mt-4 text-sm text-accent hover:text-accent-hover transition-colors"
      >
        ← Back to feed
      </a>
    </div>
  {:else}
    <!-- Back link -->
    <a
      href={`${config.site.basePath}/`}
      class="mb-8 inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors animate-fade-up"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 2L4 7l5 5" />
      </svg>
      Back to feed
    </a>

    <!-- Header -->
    <div class="mb-8 animate-fade-up" style="animation-delay: 60ms">
      <div class="mb-3 flex items-center gap-2 text-sm text-text-muted">
        <span>{post.metadata.team}</span>
        {#if post.metadata.project}
          <span class="opacity-40">·</span>
          <a href={`${config.site.basePath}/project/${slugify(post.metadata.project)}`}
            class="hover:text-accent transition-colors">{post.metadata.project}</a>
        {/if}
        <span class="opacity-40">·</span>
        <span>{timeAgo(post.createdAt)}</span>
      </div>

      <h1 class="mb-4 font-heading text-4xl font-bold leading-tight tracking-tight text-text-primary md:text-5xl">
        {post.metadata.title}
      </h1>

      <!-- Authors -->
      <div class="flex items-center gap-3">
        <div class="flex -space-x-2">
          {#each post.metadata.authors as author}
            <img src={`https://github.com/${author}.png`} alt={author} class="h-8 w-8 rounded-full border-2 border-surface object-cover" loading="lazy" />
          {/each}
        </div>
        <span class="text-sm text-text-secondary">
          {#each post.metadata.authors as author, i}
            <a href={`${config.site.basePath}/user/${author}`} class="hover:text-accent transition-colors">{author}</a>{#if i < post.metadata.authors.length - 1}{' & '}{/if}
          {/each}
        </span>
        {#if post.metadata.collaborators && post.metadata.collaborators.length > 0}
          <span class="text-sm text-text-muted">with</span>
          <div class="flex -space-x-1.5">
            {#each post.metadata.collaborators as collab}
              <img src={`https://github.com/${collab}.png`} alt={collab} class="h-7 w-7 rounded-full border-2 border-surface object-cover" loading="lazy" />
            {/each}
          </div>
          <span class="text-sm text-text-muted">
            {#each post.metadata.collaborators as collab, i}
              <a href={`${config.site.basePath}/user/${collab}`} class="hover:text-accent transition-colors">{collab}</a>{#if i < post.metadata.collaborators.length - 1}{', '}{/if}
            {/each}
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
      <p class="max-w-2xl text-lg leading-relaxed text-text-secondary">
        <RichText text={post.body} />
      </p>
    </div>

    <!-- Post reactions -->
    {#if post}
      <div class="flex items-center gap-1.5 mb-10 flex-wrap animate-fade-up" style="animation-delay: 200ms">
        {#each post.reactions ?? [] as reaction}
          <button
            class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors {reaction.viewerHasReacted ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-text-muted hover:border-text-muted'}"
            onclick={() => toggleReaction(post!, reaction.content)}
          >
            <span>{REACTION_EMOJI[reaction.content] ?? reaction.content}</span>
            <span>{reaction.totalCount}</span>
          </button>
        {/each}
        <div class="relative group">
          <button
            class="inline-flex items-center rounded-full border border-transparent px-1.5 py-0.5 text-sm text-text-muted hover:border-border hover:bg-surface-overlay transition-colors"
            onclick={(e: MouseEvent) => {
              const target = e.currentTarget as HTMLElement;
              const picker = target.nextElementSibling;
              if (picker) picker.classList.toggle('hidden');
            }}
          >
            😀+
          </button>
          <div class="hidden absolute bottom-full left-0 mb-1 z-10 rounded-xl border border-border bg-surface-raised p-1.5 shadow-xl flex gap-0.5">
            {#each Object.entries(REACTION_EMOJI) as [content, emoji]}
              {@const reacted = post?.reactions?.some(r => r.content === content && r.viewerHasReacted)}
              <button
                class="rounded-lg p-1.5 text-sm transition-colors {reacted ? 'bg-accent/15 ring-1 ring-accent/40' : 'hover:bg-surface-overlay'}"
                onclick={(e: MouseEvent) => {
                  toggleReaction(post!, content);
                  const picker = (e.currentTarget as HTMLElement).parentElement;
                  if (picker) picker.classList.add('hidden');
                }}
              >
                {emoji}
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- External URLs -->
    {#if post.metadata.urls.length > 0}
      <div class="mb-10 animate-fade-up" style="animation-delay: 240ms">
        <h3 class="mb-3 text-sm font-medium uppercase tracking-widest text-text-muted">Links</h3>
        <div class="flex flex-wrap gap-3">
          {#each post.metadata.urls as url}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              class="group flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-secondary transition-all hover:border-accent hover:text-accent"
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
        <h3 class="mb-3 text-sm font-medium uppercase tracking-widest text-text-muted">Tags</h3>
        <div class="flex flex-wrap gap-2">
          {#each post.metadata.tags as tag}
            <span class="rounded-full bg-surface-overlay px-3 py-1 text-sm text-text-muted">
              {tag}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Actions -->
    {#if isAuthor}
    <div class="flex items-center gap-3 border-t border-border-subtle pt-6 animate-fade-up" style="animation-delay: 360ms">
      <button
        class="rounded-full border border-border px-4 py-2 text-sm text-text-secondary hover:border-text-muted hover:text-text-primary transition-colors"
        onclick={() => startEditing()}
      >
        Edit
      </button>
      <div class="relative">
        <button
          class="rounded-full border border-border px-4 py-2 text-sm text-text-muted hover:border-red-500/50 hover:text-red-400 transition-colors"
          onclick={() => (showDeleteConfirm = !showDeleteConfirm)}
        >
          Delete
        </button>
        {#if showDeleteConfirm}
          <div class="absolute left-0 top-full mt-2 rounded-xl border border-border bg-surface-raised p-4 shadow-xl animate-fade-in z-10">
            <p class="mb-3 text-sm text-text-secondary">Delete this drop?</p>
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
                class="rounded-full border border-border px-4 py-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
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
      <div class="mt-12 border-t border-border-subtle pt-8 animate-fade-up" style="animation-delay: 420ms">
        <h3 class="mb-6 font-heading text-2xl text-text-primary">
          Comments
          {#if post.commentCount > 0}
            <span class="ml-2 text-lg text-text-muted">({post.commentCount})</span>
          {/if}
        </h3>

        <!-- Comment input -->
        <div class="mb-8 rounded-xl border border-border bg-surface-raised p-4">
          <AutocompleteTextarea
            bind:value={commentText}
            placeholder="Add a comment…"
            rows={3}
            disabled={submittingComment}
            class="w-full resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50"
          />
          {#if commentError}
            <p class="mt-2 text-sm text-red-400">{commentError}</p>
          {/if}
          <div class="mt-3 flex justify-end">
            <button
              class="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <a href={`${config.site.basePath}/user/${comment.author.login}`} class="text-sm font-medium text-text-primary hover:text-accent transition-colors">{comment.author.login}</a>
                    <span class="text-sm text-text-muted">{timeAgo(comment.createdAt)}</span>
                    <button class="text-sm text-text-muted hover:text-accent transition-colors"
                      onclick={() => startReply(comment.id, comment.author.login)}>
                      Reply
                    </button>
                    {#if $currentUser?.login === comment.author.login}
                      <button
                        class="ml-auto text-sm text-text-muted hover:text-red-400 transition-colors"
                        onclick={() => handleDeleteComment(comment.id)}
                      >
                        Delete
                      </button>
                    {/if}
                  </div>
                  <p class="mt-1 text-sm text-text-secondary"><RichText text={comment.body} /></p>

                  <!-- Comment reactions -->
                  <div class="flex items-center gap-1.5 mt-2 flex-wrap">
                    {#each comment.reactions ?? [] as reaction}
                      <button
                        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors {reaction.viewerHasReacted ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-text-muted hover:border-text-muted'}"
                        onclick={() => toggleReaction(comment, reaction.content)}
                      >
                        <span>{REACTION_EMOJI[reaction.content] ?? reaction.content}</span>
                        <span>{reaction.totalCount}</span>
                      </button>
                    {/each}
                    <div class="relative group">
                      <button
                        class="inline-flex items-center rounded-full border border-transparent px-1.5 py-0.5 text-sm text-text-muted hover:border-border hover:bg-surface-overlay transition-colors"
                        onclick={(e: MouseEvent) => {
                          const target = e.currentTarget as HTMLElement;
                          const picker = target.nextElementSibling;
                          if (picker) picker.classList.toggle('hidden');
                        }}
                      >
                        😀+
                      </button>
                      <div class="hidden absolute bottom-full left-0 mb-1 z-10 rounded-xl border border-border bg-surface-raised p-1.5 shadow-xl flex gap-0.5">
                        {#each Object.entries(REACTION_EMOJI) as [content, emoji]}
                          {@const reacted = comment.reactions?.some(r => r.content === content && r.viewerHasReacted)}
                          <button
                            class="rounded-lg p-1.5 text-sm transition-colors {reacted ? 'bg-accent/15 ring-1 ring-accent/40' : 'hover:bg-surface-overlay'}"
                            onclick={(e: MouseEvent) => {
                              toggleReaction(comment, content);
                              const picker = (e.currentTarget as HTMLElement).parentElement;
                              if (picker) picker.classList.add('hidden');
                            }}
                          >
                            {emoji}
                          </button>
                        {/each}
                      </div>
                    </div>
                  </div>

                  {#if comment.replies && comment.replies.length > 0}
                    <div class="mt-3 space-y-3 border-l-2 border-border-subtle pl-4">
                      {#each comment.replies as reply}
                        <div class="flex gap-2.5">
                          <img src={`https://github.com/${reply.author.login}.png`} alt={reply.author.login} class="h-6 w-6 shrink-0 rounded-full object-cover" loading="lazy" />
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                              <a href={`${config.site.basePath}/user/${reply.author.login}`} class="text-sm font-medium text-text-primary hover:text-accent transition-colors">{reply.author.login}</a>
                              <span class="text-sm text-text-muted">{timeAgo(reply.createdAt)}</span>
                              {#if $currentUser?.login === reply.author.login}
                                <button class="ml-auto text-sm text-text-muted hover:text-red-400 transition-colors"
                                  onclick={() => handleDeleteComment(reply.id)}>Delete</button>
                              {/if}
                            </div>
                            <p class="mt-0.5 text-sm text-text-secondary"><RichText text={reply.body} /></p>

                            <!-- Reply reactions -->
                            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {#each reply.reactions ?? [] as reaction}
                                <button
                                  class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors {reaction.viewerHasReacted ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-text-muted hover:border-text-muted'}"
                                  onclick={() => toggleReaction(reply, reaction.content)}
                                >
                                  <span>{REACTION_EMOJI[reaction.content] ?? reaction.content}</span>
                                  <span>{reaction.totalCount}</span>
                                </button>
                              {/each}
                              <div class="relative group">
                                <button
                                  class="inline-flex items-center rounded-full border border-transparent px-1.5 py-0.5 text-sm text-text-muted hover:border-border hover:bg-surface-overlay transition-colors"
                                  onclick={(e: MouseEvent) => {
                                    const target = e.currentTarget as HTMLElement;
                                    const picker = target.nextElementSibling;
                                    if (picker) picker.classList.toggle('hidden');
                                  }}
                                >
                                  😀+
                                </button>
                                <div class="hidden absolute bottom-full left-0 mb-1 z-10 rounded-xl border border-border bg-surface-raised p-1.5 shadow-xl flex gap-0.5">
                                  {#each Object.entries(REACTION_EMOJI) as [content, emoji]}
                                    {@const reacted = reply.reactions?.some(r => r.content === content && r.viewerHasReacted)}
                                    <button
                                      class="rounded-lg p-1.5 text-sm transition-colors {reacted ? 'bg-accent/15 ring-1 ring-accent/40' : 'hover:bg-surface-overlay'}"
                                      onclick={(e: MouseEvent) => {
                                        toggleReaction(reply, content);
                                        const picker = (e.currentTarget as HTMLElement).parentElement;
                                        if (picker) picker.classList.add('hidden');
                                      }}
                                    >
                                      {emoji}
                                    </button>
                                  {/each}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  {#if replyingTo === comment.id}
                    <div class="mt-3 flex gap-2.5">
                      <div class="flex-1">
                        <AutocompleteTextarea bind:value={replyText} placeholder={`Reply to ${replyingToUser}…`} rows={2}
                          class="w-full resize-none rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <button onclick={() => handleReply(comment.id)} disabled={submittingReply || !replyText.trim()}
                          class="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-50 transition-opacity">
                          {submittingReply ? '…' : 'Reply'}
                        </button>
                        <button onclick={() => { replyingTo = null; replyText = ''; }}
                          class="rounded-lg px-3 py-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          {:else}
            <p class="text-center text-sm text-text-muted">
              No comments yet
            </p>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>
