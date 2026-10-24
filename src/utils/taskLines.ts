/** How many tasks one "add several" request takes (the API answers 422 for more). */
export const MAX_NEW_TASKS = 100;

/** A list marker people paste in front of a line: "- ", "* ", "• ", "1. ", "2) ". */
const MARKER = /^(?:[-*•]\s+|\d+[.)]\s+)/;

/**
 * The task titles of a pasted list: one per line, trimmed, blank lines dropped and a leading list
 * marker removed, so a bulleted or numbered list can be pasted as it is.
 */
export function parseTaskLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(MARKER, '').trim())
    .filter((line) => line !== '');
}
