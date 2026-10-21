import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RichText } from './RichText';

describe('RichText', () => {
  it('shows a plain text with its line breaks when there is no html', () => {
    const { container } = render(<RichText html={null} text={'one\ntwo <b>not bold</b>'} />);
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toBe('one\ntwo <b>not bold</b>');
  });

  it('shows the formatting of the html', () => {
    const { container } = render(
      <RichText
        html="<h2>Title</h2><p>A <strong>bold</strong> and <em>italic</em> word</p><ul><li>one</li></ul>"
        text="ignored"
      />,
    );
    expect(container.querySelector('h2')).toHaveTextContent('Title');
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('li')).toHaveTextContent('one');
    expect(container).not.toHaveTextContent('ignored');
  });

  it('opens a safe link in a new tab without leaking the page', () => {
    render(<RichText html='<p><a href="https://example.com/x">site</a></p>' text="" />);
    const link = screen.getByRole('link', { name: 'site' });
    expect(link).toHaveAttribute('href', 'https://example.com/x');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
  });

  it('never shows script, handlers, images or unsafe links, whatever the html says', () => {
    const { container } = render(
      <RichText
        html={
          '<p onclick="x()">hi</p><script>window.hacked=1</script><img src=x onerror="window.hacked=1">' +
          '<a href="javascript:window.hacked=1">bad</a><iframe src="https://evil.example"></iframe>' +
          '<svg onload="window.hacked=1"></svg><style>p{display:none}</style>'
        }
        text=""
      />,
    );
    expect(container.querySelector('script, img, iframe, svg, style')).toBeNull();
    expect(container.querySelector('[onclick], [onerror], [onload]')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container).toHaveTextContent('hi');
    expect(container).toHaveTextContent('bad');
    expect((window as { hacked?: number }).hacked).toBeUndefined();
  });
});
