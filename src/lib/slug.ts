/** Slugify a title and append the discussion ID for a clean post URL. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const SEPARATOR = '--';

/** Build a post URL param combining slug + ID: `my-title--D_kwDO...` */
export function buildPostParam(title: string, id: string): string {
  return `${slugify(title)}${SEPARATOR}${id}`;
}

/** Extract the discussion ID from a post URL param. */
export function parsePostParam(param: string): string | null {
  const idx = param.lastIndexOf(SEPARATOR);
  if (idx === -1) return null;
  return param.slice(idx + SEPARATOR.length) || null;
}
