export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;
/** The API's rule for a slug: lowercase letters, digits and inner hyphens. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/**
 * The slug the API would derive from a name, for the live preview: lowercase ASCII
 * letters and digits, everything else collapsed to single hyphens. The server has the
 * last word (it also adds a numeric suffix when the slug is taken).
 */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
}
