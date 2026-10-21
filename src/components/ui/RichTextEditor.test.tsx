import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { RichTextEditor, type RichTextValue } from './RichTextEditor';
import { normaliseLink } from './richTextLink';
import { plainTextToHtml } from './richTextPlain';

function Harness({
  onFiles,
  onSubmitShortcut,
  onEscape,
  initial = '',
}: {
  onFiles?: (files: File[]) => void;
  onSubmitShortcut?: () => void;
  onEscape?: () => void;
  initial?: string;
}) {
  const [value, setValue] = useState<RichTextValue>({ html: initial, text: '' });
  return (
    <>
      <RichTextEditor
        label="Notes"
        value={value.html}
        onChange={setValue}
        onFiles={onFiles}
        onSubmitShortcut={onSubmitShortcut}
        onEscape={onEscape}
      />
      <output data-testid="html">{value.html}</output>
      <output data-testid="text">{value.text}</output>
      <button type="button" onClick={() => setValue({ html: '', text: '' })}>
        clear
      </button>
    </>
  );
}

const area = () => screen.getByRole('textbox', { name: 'Notes' });
const png = () => new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' });
const clipboard = (files: File[], text = '') => ({
  clipboardData: {
    files,
    types: ['Files'],
    getData: (type: string) => (type === 'text/plain' ? text : ''),
  },
});

describe('RichTextEditor', () => {
  it('types text and reports its html and its plain text', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(area());
    await user.keyboard('Hello world');

    await waitFor(() => expect(screen.getByTestId('text')).toHaveTextContent('Hello world'));
    expect(screen.getByTestId('html')).toHaveTextContent('<p>Hello world</p>');
  });

  it('keeps every key even when the parent is slower than the typing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(area());
    await user.keyboard('The quick brown fox jumps over the lazy dog');
    await waitFor(() =>
      expect(screen.getByTestId('text')).toHaveTextContent(
        'The quick brown fox jumps over the lazy dog',
      ),
    );
  });

  it('shows the html it is given', () => {
    renderWithProviders(<Harness initial="<p>Saved <strong>text</strong></p>" />);
    expect(area()).toHaveTextContent('Saved text');
    expect(area().querySelector('strong')).not.toBeNull();
  });

  it('is emptied when the parent sets an empty value (the box cleared after sending)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(area());
    await user.keyboard('draft');
    await waitFor(() => expect(screen.getByTestId('text')).toHaveTextContent('draft'));

    await user.click(screen.getByRole('button', { name: 'clear' }));
    await waitFor(() => expect(area()).not.toHaveTextContent('draft'));
    expect(screen.getByTestId('html')).toBeEmptyDOMElement();
  });

  it('sends with Ctrl+Enter and cancels with Escape, and leaves a plain Enter alone', () => {
    const submit = vi.fn();
    const escape = vi.fn();
    renderWithProviders(<Harness onSubmitShortcut={submit} onEscape={escape} />);

    fireEvent.keyDown(area(), { key: 'Enter' });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.keyDown(area(), { key: 'Enter', ctrlKey: true });
    expect(submit).toHaveBeenCalledOnce();
    fireEvent.keyDown(area(), { key: 'Enter', metaKey: true });
    expect(submit).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(area(), { key: 'Escape' });
    expect(escape).toHaveBeenCalledOnce();
  });

  it('hands a pasted screenshot to onFiles instead of the text', () => {
    const onFiles = vi.fn();
    renderWithProviders(<Harness onFiles={onFiles} />);
    fireEvent.paste(area(), clipboard([png()]));
    expect(onFiles).toHaveBeenCalledOnce();
    expect(onFiles.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it('leaves a paste that carries text to the editor', () => {
    const onFiles = vi.fn();
    renderWithProviders(<Harness onFiles={onFiles} />);
    fireEvent.paste(area(), clipboard([png()], 'A1\tB1'));
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('has a formatting toolbar whose buttons show what is on', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    const bold = screen.getByRole('button', { name: 'Bold' });
    expect(bold).toHaveAttribute('aria-pressed', 'false');
    await user.click(area());
    await user.click(bold);
    await waitFor(() => expect(bold).toHaveAttribute('aria-pressed', 'true'));
    for (const name of [
      'Italic',
      'Underline',
      'Strikethrough',
      'Bulleted list',
      'Numbered list',
      'Quote',
      'Code',
      'Add link',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('asks for a web address when a link is added, and refuses one that is not', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(area());
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    await user.type(screen.getByLabelText('Link address'), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a web address');
  });
});

describe('normaliseLink', () => {
  it('adds https:// to a bare address and keeps http, https and mailto', () => {
    expect(normaliseLink('example.com/a')).toBe('https://example.com/a');
    expect(normaliseLink(' http://example.com ')).toBe('http://example.com');
    expect(normaliseLink('mailto:a@example.com')).toBe('mailto:a@example.com');
  });

  it('refuses anything else', () => {
    for (const bad of [
      '',
      '  ',
      'javascript:alert(1)',
      'data:text/html,x',
      'ftp://x.example',
      'a b',
    ]) {
      expect(normaliseLink(bad)).toBeNull();
    }
  });
});

describe('plainTextToHtml', () => {
  it('makes a paragraph per line and escapes markup', () => {
    expect(plainTextToHtml('one\r\ntwo <b>&')).toBe('<p>one</p><p>two &lt;b&gt;&amp;</p>');
    expect(plainTextToHtml('   ')).toBe('');
  });
});
