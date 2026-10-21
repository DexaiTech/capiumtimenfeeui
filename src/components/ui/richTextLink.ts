const LINK_OK = /^(?:https?:\/\/|mailto:)\S+$/i;

/** What a person types in the link box: "example.com" becomes https://example.com. */
export function normaliseLink(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  return LINK_OK.test(withScheme) ? withScheme : null;
}
