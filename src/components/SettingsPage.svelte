<script lang="ts">
  import { auth } from '../lib/stores/auth';
  import { config } from '../lib/config';

  let showConfirm = $state(false);

  function handleSignOut() {
    auth.logout();
    window.location.href = config.site.basePath || '/';
  }
</script>

<div class="mx-auto max-w-sm px-4 py-16">
  <h1 class="font-heading text-2xl text-text-primary mb-8">Settings</h1>

  <section>
    <button
      onclick={() => (showConfirm = true)}
      class="w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-text-secondary hover:border-red-400/50 hover:text-red-400 transition-colors"
    >
      Sign out
    </button>
  </section>
</div>

<!-- Sign-out confirmation dialog -->
{#if showConfirm}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onkeydown={(e) => e.key === 'Escape' && (showConfirm = false)}
    onclick={(e) => e.target === e.currentTarget && (showConfirm = false)}
  >
    <div class="mx-4 w-full max-w-sm rounded-2xl border border-border bg-surface-raised p-6 shadow-xl animate-fade-in">
      <h2 class="text-lg font-medium text-text-primary mb-2">Sign out?</h2>
      <p class="text-sm text-text-secondary mb-6">
        Your Personal Access Token (PAT) will be removed from this browser. You'll need to create a new one to sign in again.
      </p>
      <div class="flex gap-3">
        <button
          onclick={() => (showConfirm = false)}
          class="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-overlay transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={handleSignOut}
          class="flex-1 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  </div>
{/if}
