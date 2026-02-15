import type { PostMetadata } from './types/post';
import { config } from './config';
import { slugify } from './slug';

const DD_META_RE = /<!--\s*dd-meta\s*\n([\s\S]*?)\n\s*-->/;
const DD_BODY_RE = /<!-- dd-body-start -->\n([\s\S]*?)\n<!-- dd-body-end -->/;

export function parseMetadata(body: string): PostMetadata | null {
  const match = body.match(DD_META_RE);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as PostMetadata;
  } catch {
    return null;
  }
}

export function serializeMetadata(meta: PostMetadata, bodyText: string, discussionNumber?: number): string {
  const json = JSON.stringify(meta, null, 2);
  const slug = slugify(meta.title);
  const numberPrefix = discussionNumber ? `${discussionNumber}/` : '';
  const postUrl = `${config.site.siteUrl}${config.site.basePath}/post/${numberPrefix}${slug}`;

  const parts: string[] = [];

  parts.push(`## ${meta.title}`);
  parts.push('');
  parts.push('<!-- dd-body-start -->');
  parts.push(bodyText);
  parts.push('<!-- dd-body-end -->');

  // Inline images from assets
  const images = meta.assets.filter(a => a.url && !a.pendingCDN);
  if (images.length > 0) {
    parts.push('');
    for (const asset of images) {
      parts.push(`![${meta.title}](${asset.url})`);
    }
  }

  if (meta.collaborators && meta.collaborators.length > 0) {
    parts.push('');
    parts.push(`**Collaborators:** ${meta.collaborators.join(', ')}`);
  }

  if (meta.tags.length > 0) {
    parts.push('');
    parts.push(`**Tags:** ${meta.tags.join(', ')}`);
  }

  if (meta.team) {
    parts.push('');
    parts.push(`**Team:** ${meta.team}`);
  }

  if (meta.project) {
    parts.push('');
    parts.push(`**Project:** ${meta.project}`);
  }

  if (meta.urls.length > 0) {
    parts.push('');
    parts.push('**Links:**');
    for (const url of meta.urls) {
      parts.push(`- ${url}`);
    }
  }

  parts.push('');
  parts.push('---');
  parts.push('');
  parts.push(`> ✏️ This discussion was created by [Design Drops](${postUrl}). To view or edit this post, [open it in Design Drops](${postUrl}).`);
  parts.push('');
  parts.push(`<!-- dd-meta\n${json}\n-->`);

  return parts.join('\n');
}

export function extractBodyText(body: string): string {
  // Prefer dd-body markers if present
  const bodyMatch = body.match(DD_BODY_RE);
  if (bodyMatch) {
    return bodyMatch[1].trim();
  }
  // Backwards compat: strip dd-meta block and return the rest
  return body.replace(DD_META_RE, '').trim();
}
