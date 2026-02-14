import type { PostMetadata } from './types/post';

const DD_META_RE = /<!--\s*dd-meta\s*\n([\s\S]*?)\n\s*-->/;

export function parseMetadata(body: string): PostMetadata | null {
  const match = body.match(DD_META_RE);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as PostMetadata;
  } catch {
    return null;
  }
}

export function serializeMetadata(meta: PostMetadata, bodyText: string): string {
  const json = JSON.stringify(meta, null, 2);
  return `${bodyText}\n\n<!-- dd-meta\n${json}\n-->`;
}

export function extractBodyText(body: string): string {
  return body.replace(DD_META_RE, '').trim();
}
