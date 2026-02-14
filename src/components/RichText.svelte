<script lang="ts">
  import { config } from '../lib/config';
  import { slugify } from '../lib/slug';

  let { text = '' }: { text: string } = $props();

  interface TextSegment {
    type: 'text' | 'mention' | 'project';
    value: string;
  }

  // Escape special regex characters in a string
  function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const baseUrl = escapeRegex(`${config.site.siteUrl}${config.site.basePath}`);

  function parseText(input: string): TextSegment[] {
    const segments: TextSegment[] = [];
    // Match @mentions, [[project]] syntax, and markdown links to project pages
    const regex = new RegExp(
      `@([a-zA-Z0-9_-]+)|\\[\\[([^\\]]+)\\]\\]|\\[([^\\]]+)\\]\\(${baseUrl}/project/[^)]+\\)`,
      'g'
    );
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: input.slice(lastIndex, match.index) });
      }
      if (match[1]) {
        segments.push({ type: 'mention', value: match[1] });
      } else if (match[2]) {
        segments.push({ type: 'project', value: match[2] });
      } else if (match[3]) {
        // Markdown link to project page — use link text as project name
        segments.push({ type: 'project', value: match[3] });
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < input.length) {
      segments.push({ type: 'text', value: input.slice(lastIndex) });
    }
    return segments;
  }

  const segments = $derived(parseText(text));
</script>

{#each segments as segment}
  {#if segment.type === 'mention'}
    <a href={`${config.site.basePath}/user/${segment.value}`}
      class="font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors">@{segment.value}</a>
  {:else if segment.type === 'project'}
    <a href={`${config.site.basePath}/project/${slugify(segment.value)}`}
      class="font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors">[[{segment.value}]]</a>
  {:else}
    {segment.value}
  {/if}
{/each}
