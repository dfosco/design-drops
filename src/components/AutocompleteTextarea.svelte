<script lang="ts">
  import { config } from '../lib/config';
  import { authToken } from '../lib/stores/auth';
  import { fetchRepoCollaborators, searchGitHubUsers } from '../lib/api/users';

  let {
    value = $bindable(''),
    placeholder = '',
    rows = 3,
    disabled = false,
    projects = [] as string[],
    class: className = '',
  }: {
    value: string;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    projects?: string[];
    class?: string;
  } = $props();

  let textarea: HTMLTextAreaElement;
  let showMentionDropdown = $state(false);
  let showProjectDropdown = $state(false);
  let mentionQuery = $state('');
  let projectQuery = $state('');
  let suggestions: string[] = $state([]);
  let knownUsers: string[] = $state([]);
  let cursorPosition = $state(0);
  let selectedIndex = $state(0);

  $effect(() => {
    const token = $authToken;
    if (token && knownUsers.length === 0) {
      fetchRepoCollaborators(token).then(users => { knownUsers = users; });
    }
  });

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    cursorPosition = target.selectionStart ?? 0;
    const textBefore = value.slice(0, cursorPosition);

    // Check for @mention trigger
    const mentionMatch = textBefore.match(/@([a-zA-Z0-9_-]*)$/);
    if (mentionMatch) {
      mentionQuery = mentionMatch[1];
      showMentionDropdown = true;
      showProjectDropdown = false;
      selectedIndex = 0;
      const q = mentionQuery.toLowerCase();
      suggestions = knownUsers.filter(u => u.toLowerCase().includes(q)).slice(0, 6);
      if (suggestions.length < 3 && q.length >= 2) {
        const token = $authToken;
        if (token) {
          searchGitHubUsers(token, q).then(results => {
            suggestions = [...new Set([...suggestions, ...results])].slice(0, 6);
          });
        }
      }
      return;
    }

    // Check for [[project]] trigger
    const projectMatch = textBefore.match(/\[\[([^\]]*)$/);
    if (projectMatch) {
      projectQuery = projectMatch[1];
      showProjectDropdown = true;
      showMentionDropdown = false;
      selectedIndex = 0;
      const q = projectQuery.toLowerCase();
      suggestions = projects.filter(p => p.toLowerCase().includes(q)).slice(0, 6);
      return;
    }

    showMentionDropdown = false;
    showProjectDropdown = false;
  }

  function insertSuggestion(suggestion: string) {
    const textBefore = value.slice(0, cursorPosition);
    const textAfter = value.slice(cursorPosition);

    if (showMentionDropdown) {
      const mentionStart = textBefore.lastIndexOf('@');
      value = textBefore.slice(0, mentionStart) + `@${suggestion} ` + textAfter;
    } else if (showProjectDropdown) {
      const projectStart = textBefore.lastIndexOf('[[');
      value = textBefore.slice(0, projectStart) + `[[${suggestion}]] ` + textAfter;
    }

    showMentionDropdown = false;
    showProjectDropdown = false;
    requestAnimationFrame(() => textarea?.focus());
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!showMentionDropdown && !showProjectDropdown) return;
    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % suggestions.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + suggestions.length) % suggestions.length;
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertSuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      showMentionDropdown = false;
      showProjectDropdown = false;
    }
  }
</script>

<div class="relative">
  <textarea
    bind:this={textarea}
    bind:value
    {placeholder}
    {rows}
    {disabled}
    oninput={handleInput}
    onkeydown={handleKeydown}
    class={className || "w-full resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50"}
  ></textarea>

  {#if (showMentionDropdown || showProjectDropdown) && suggestions.length > 0}
    <div class="absolute left-0 bottom-full z-50 mb-1 min-w-[200px] max-w-[280px] rounded-xl border border-border bg-surface-raised p-1 shadow-xl animate-fade-in">
      {#each suggestions as suggestion, i}
        <button
          class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors {i === selectedIndex ? 'bg-surface-overlay text-text-primary' : 'text-text-secondary hover:bg-surface-overlay'}"
          onclick={() => insertSuggestion(suggestion)}
          onmouseenter={() => (selectedIndex = i)}
        >
          {#if showMentionDropdown}
            <img src={`https://github.com/${suggestion}.png`} alt={suggestion} class="h-5 w-5 rounded-full object-cover" />
            <span>@{suggestion}</span>
          {:else}
            <span>[[{suggestion}]]</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
