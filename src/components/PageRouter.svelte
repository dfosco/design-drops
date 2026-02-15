<script lang="ts">
  import { config } from '../lib/config';
  import PostDetail from './PostDetail.svelte';
  import UserProfile from './UserProfile.svelte';
  import ProjectProfile from './ProjectProfile.svelte';
  import SettingsPage from './SettingsPage.svelte';

  type Route = 'post' | 'user' | 'project' | 'settings' | 'unknown';

  function getRoute(): Route {
    if (typeof window === 'undefined') return 'unknown';
    const path = window.location.pathname;
    if (path.startsWith(`${config.site.basePath}/post/`)) return 'post';
    if (path.startsWith(`${config.site.basePath}/user/`)) return 'user';
    if (path.startsWith(`${config.site.basePath}/project/`)) return 'project';
    if (path.startsWith(`${config.site.basePath}/settings`)) return 'settings';
    return 'unknown';
  }

  let route: Route = $state('unknown');

  $effect(() => {
    route = getRoute();
  });
</script>

{#if route === 'post'}
  <PostDetail />
{:else if route === 'user'}
  <UserProfile />
{:else if route === 'project'}
  <ProjectProfile />
{:else if route === 'settings'}
  <SettingsPage />
{:else}
  <div class="mx-auto max-w-4xl px-[var(--spacing-page)] pt-10 pb-20">
    <div class="flex flex-col items-center justify-center py-32 text-center animate-fade-up">
      <div class="mb-4 text-6xl opacity-20">✦</div>
      <p class="text-xl text-text-muted">Page not found</p>
      <a href={`${config.site.basePath}/`} class="mt-4 text-sm text-accent hover:text-accent-hover transition-colors">
        ← Back to feed
      </a>
    </div>
  </div>
{/if}
