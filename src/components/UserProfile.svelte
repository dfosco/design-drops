<script lang="ts">
  import type { Post } from '../lib/types/post';
  import type { UserComment } from '../lib/types/post';
  import PostCard from './PostCard.svelte';
  import RichText from './RichText.svelte';
  import { config } from '../lib/config';
  import { authToken } from '../lib/stores/auth';
  import { fetchPosts, fetchUserComments, fetchRepoIds, postUrl } from '../lib/api/queries';
  import { AuthError } from '../lib/api/graphql';
  import { auth } from '../lib/stores/auth';

  type Tab = 'posts' | 'comments';

  let username = $state('');
  let tab: Tab = $state('posts');
  let allPosts: Post[] = $state([]);
  let userComments: UserComment[] = $state([]);
  let loading = $state(true);
  let commentsLoading = $state(false);
  let commentsLoaded = $state(false);

  function getUsernameFromPath(): string | null {
    const prefix = `${config.site.basePath}/user/`;
    const path = window.location.pathname;
    if (!path.startsWith(prefix)) return null;
    const name = path.slice(prefix.length).replace(/\/+$/, '');
    return name || null;
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function commentPostUrl(c: UserComment): string {
    return `${config.site.basePath}/post/${c.postNumber}/${c.postSlug}`;
  }

  $effect(() => {
    const name = getUsernameFromPath();
    if (!name) { loading = false; return; }
    username = name;

    const token = $authToken;
    if (!token) { loading = false; return; }

    loading = true;
    fetchRepoIds(token, config.repo.owner, config.repo.name, config.discussions.category)
      .then(({ categoryId }) => fetchPosts(token, config.repo.owner, config.repo.name, categoryId, 100))
      .then((posts) => { allPosts = posts; loading = false; })
      .catch((err) => {
        if (err instanceof AuthError) { auth.logout(); return; }
        loading = false;
      });
  });

  // Load comments lazily when tab switches
  $effect(() => {
    if (tab !== 'comments' || commentsLoaded || !username) return;
    const token = $authToken;
    if (!token) return;

    commentsLoading = true;
    fetchRepoIds(token, config.repo.owner, config.repo.name, config.discussions.category)
      .then(({ categoryId }) => fetchUserComments(token, config.repo.owner, config.repo.name, categoryId, username, 100))
      .then((comments) => { userComments = comments; commentsLoaded = true; commentsLoading = false; })
      .catch((err) => {
        if (err instanceof AuthError) { auth.logout(); return; }
        commentsLoading = false;
      });
  });

  const userPosts = $derived(
    allPosts.filter(p =>
      p.metadata.authors.includes(username) ||
      (p.metadata.collaborators ?? []).includes(username)
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );

  const postCount = $derived(userPosts.length);
</script>

<div class="mx-auto max-w-4xl px-[var(--spacing-page)] pt-10 pb-20">
  {#if loading}
    <div class="animate-pulse">
      <div class="mb-4 h-16 w-16 rounded-full bg-surface-overlay"></div>
      <div class="mb-6 h-8 w-48 rounded bg-surface-overlay"></div>
    </div>
  {:else if !username}
    <div class="flex flex-col items-center justify-center py-32 text-center animate-fade-up">
      <div class="mb-4 text-6xl opacity-20">✦</div>
      <p class="text-xl text-text-muted">User not found</p>
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

    <!-- Profile header -->
    <div class="mb-10 flex items-center gap-5 animate-fade-up" style="animation-delay: 60ms">
      <img src={`https://github.com/${username}.png`} alt={username} class="h-16 w-16 rounded-full object-cover" />
      <div>
        <h1 class="font-heading text-3xl font-bold text-text-primary">{username}</h1>
        <p class="text-sm text-text-muted">
          {postCount} {postCount === 1 ? 'post' : 'posts'}
        </p>
      </div>
    </div>

    <!-- Segmented control -->
    <div class="mb-8 inline-flex rounded-lg border border-border p-0.5 animate-fade-up" style="animation-delay: 120ms">
      <button
        class="rounded-md px-4 py-2 text-sm transition-colors {tab === 'posts' ? 'bg-surface-overlay text-text-primary font-medium' : 'text-text-muted hover:text-text-secondary'}"
        onclick={() => (tab = 'posts')}>
        Posts
      </button>
      <button
        class="rounded-md px-4 py-2 text-sm transition-colors {tab === 'comments' ? 'bg-surface-overlay text-text-primary font-medium' : 'text-text-muted hover:text-text-secondary'}"
        onclick={() => (tab = 'comments')}>
        Comments
      </button>
    </div>

    {#if tab === 'posts'}
      {#if userPosts.length === 0}
        <div class="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
          <div class="mb-4 text-5xl opacity-20">✦</div>
          <p class="text-lg text-text-muted">No posts yet</p>
        </div>
      {:else}
        <div class="flex flex-col gap-8 animate-fade-up" style="animation-delay: 180ms">
          {#each userPosts as post, i (post.id)}
            <PostCard {post} index={i} />
          {/each}
        </div>
      {/if}
    {:else}
      {#if commentsLoading}
        <div class="space-y-4 animate-pulse">
          {#each [1, 2, 3] as _}
            <div class="rounded-xl border border-border bg-surface-raised p-4">
              <div class="h-3 w-32 rounded bg-surface-overlay mb-3"></div>
              <div class="h-4 w-full rounded bg-surface-overlay mb-2"></div>
              <div class="h-4 w-2/3 rounded bg-surface-overlay"></div>
            </div>
          {/each}
        </div>
      {:else if userComments.length === 0}
        <div class="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
          <div class="mb-4 text-5xl opacity-20">💬</div>
          <p class="text-lg text-text-muted">No comments yet</p>
        </div>
      {:else}
        <div class="flex flex-col gap-4 animate-fade-up" style="animation-delay: 180ms">
          {#each userComments as comment (comment.id)}
            <a
              href={commentPostUrl(comment)}
              class="block rounded-xl border border-border bg-surface-raised p-4 hover:border-text-muted transition-colors group"
            >
              <div class="mb-2 flex items-center gap-2 text-sm text-text-muted">
                {#if comment.isReply}
                  <span class="rounded-full bg-surface-overlay px-2 py-0.5">Reply</span>
                {/if}
                <span>on</span>
                <span class="font-medium text-text-secondary group-hover:text-accent transition-colors">{comment.postTitle}</span>
                <span>·</span>
                <span>{formatDate(comment.createdAt)}</span>
              </div>
              <div class="text-sm text-text-secondary line-clamp-3">
                <RichText text={comment.body} />
              </div>
            </a>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>
