import DOMPurify from 'dompurify';
import { createElement, type ReactNode } from 'react';

/** What the editor can write: the same list the API keeps (`app/utils/rich_text.py`). */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'a',
] as const;
const ALLOWED = new Set<string>(ALLOWED_TAGS);
const LINK_PROTOCOLS = /^(?:https?|mailto):/i;

function render(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (!(node instanceof Element)) return null;
  const tag = node.tagName.toLowerCase();
  if (!ALLOWED.has(tag)) return null;
  if (tag === 'br') return createElement('br', { key });
  const children = Array.from(node.childNodes).map((child, index) =>
    render(child, `${key}.${String(index)}`),
  );
  if (tag === 'a') {
    const href = node.getAttribute('href') ?? '';
    if (!LINK_PROTOCOLS.test(href)) return createElement('span', { key }, ...children);
    return createElement(
      'a',
      { key, href, target: '_blank', rel: 'noopener noreferrer nofollow' },
      ...children,
    );
  }
  return createElement(tag, { key }, ...children);
}

/**
 * The HTML of a ticket or a comment as React elements. The API sanitises on every write; this
 * sanitises again (DOMPurify, the same allow-list) and then builds elements from the result, so
 * no markup string is ever put into the page.
 */
export function richTextNodes(html: string): ReactNode[] {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: LINK_PROTOCOLS,
  });
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  return Array.from(doc.body.childNodes).map((child, index) => render(child, String(index)));
}
