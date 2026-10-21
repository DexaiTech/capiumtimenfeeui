const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

/** A plain text as the editor's HTML (a paragraph per line), to edit a text written before
 * formatting existed. */
export function plainTextToHtml(text: string): string {
  if (!text.trim()) return '';
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${line.replace(/[&<>]/g, (char) => ESCAPES[char] ?? char)}</p>`)
    .join('');
}
