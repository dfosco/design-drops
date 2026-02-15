<script lang="ts">
  import { isAuthenticated, authReady } from '../lib/stores/auth';
  import SignInModal from './SignInModal.svelte';
  import Feed from './Feed.svelte';

  let signInOpen = $state(true);

  // Keep modal open when auth succeeds (will be hidden by the #if block)
  $effect(() => {
    if (!$isAuthenticated) {
      signInOpen = true;
    }
  });
</script>

{#if !$authReady}
  <!-- Waiting for auth state to load from localStorage — show nothing to avoid flash -->
  <div></div>
{:else if $isAuthenticated}
  <slot />
{:else}
  <!-- Blurred preview feed behind the modal -->
  <div class="pointer-events-none select-none" aria-hidden="true">
    <Feed preview={true} />
  </div>
  <SignInModal bind:open={signInOpen} dismissable={false} />
{/if}
