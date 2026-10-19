/** How many avatar colours the theme defines (`--color-avatar-1` … `-8`). */
export const AVATAR_COLOR_COUNT = 8;

/** A stable palette index for a string (FNV-1a), so a person keeps their colour. */
export function avatarColorIndex(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % AVATAR_COLOR_COUNT;
}
