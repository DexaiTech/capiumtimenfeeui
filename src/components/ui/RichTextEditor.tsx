import { Link as LinkExtension } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
  Unlink,
  type LucideIcon,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { filesOfClipboard } from '@/hooks/useFileIntake';
import { cn } from '@/utils/cn';

import { Field } from './Field';
import { normaliseLink } from './richTextLink';
import { describedBy, fieldIds } from './fieldUtils';

export interface RichTextValue {
  /** The editor's HTML; '' when it holds no text. The API sanitises it again. */
  html: string;
  /** The plain text of it (blocks on their own lines). */
  text: string;
}

export interface RichTextEditorProps {
  label: ReactNode;
  hideLabel?: boolean;
  /** The accessible name of the editing area when `label` is not plain text. */
  ariaLabel?: string;
  error?: string;
  hint?: ReactNode;
  /** Marks the field as mandatory: a red star on the label and `aria-required` on the box. */
  required?: boolean;
  /** The HTML shown. A value that differs from what the editor last reported replaces its content. */
  value: string;
  onChange: (value: RichTextValue) => void;
  placeholder?: string;
  /** Pasted or dropped files (a screenshot) go here instead of into the text. */
  onFiles?: (files: File[]) => void;
  /** Ctrl+Enter (Cmd+Enter): the box's "send". */
  onSubmitShortcut?: () => void;
  /** Escape: the box's "cancel". */
  onEscape?: () => void;
  disabled?: boolean;
  /** Height classes of the writing area. */
  areaClassName?: string;
  autoFocus?: boolean;
  className?: string;
}

interface ToolButton {
  id: string;
  label: string;
  icon: LucideIcon;
  active: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

const TOOLS: ReadonlyArray<ToolButton> = [
  {
    id: 'bold',
    label: 'Bold',
    icon: Bold,
    active: (e) => e.isActive('bold'),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    id: 'italic',
    label: 'Italic',
    icon: Italic,
    active: (e) => e.isActive('italic'),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    id: 'underline',
    label: 'Underline',
    icon: UnderlineIcon,
    active: (e) => e.isActive('underline'),
    run: (e) => e.chain().focus().toggleUnderline().run(),
  },
  {
    id: 'strike',
    label: 'Strikethrough',
    icon: Strikethrough,
    active: (e) => e.isActive('strike'),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    id: 'bullets',
    label: 'Bulleted list',
    icon: List,
    active: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'numbers',
    label: 'Numbered list',
    icon: ListOrdered,
    active: (e) => e.isActive('orderedList'),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'quote',
    label: 'Quote',
    icon: Quote,
    active: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'code',
    label: 'Code',
    icon: Code,
    active: (e) => e.isActive('code') || e.isActive('codeBlock'),
    run: (e) => e.chain().focus().toggleCode().run(),
  },
];

function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  // The buttons follow the selection: re-read only what the toolbar shows.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      active: TOOLS.map((tool) => tool.active(current)),
      link: current.isActive('link'),
    }),
  });
  const [linking, setLinking] = useState(false);
  const [address, setAddress] = useState('');
  const [problem, setProblem] = useState(false);

  const openLink = () => {
    setAddress((editor.getAttributes('link') as { href?: string }).href ?? '');
    setProblem(false);
    setLinking(true);
  };
  const applyLink = () => {
    const href = normaliseLink(address);
    if (href === null) {
      setProblem(true);
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setLinking(false);
  };
  const buttonClasses = (on: boolean) =>
    cn(
      'inline-flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors duration-fast ease-standard',
      'hover:bg-surface-hover hover:text-text disabled:pointer-events-none disabled:opacity-50',
      on && 'bg-primary-soft text-primary-text',
    );

  return (
    <div className="flex flex-col gap-1.5 border-b border-border bg-surface-sunken px-1.5 py-1">
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-0.5"
      >
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          const on = state.active[index] ?? false;
          return (
            <button
              key={tool.id}
              type="button"
              aria-label={tool.label}
              aria-pressed={on}
              title={tool.label}
              disabled={disabled}
              // Keep the selection in the text while the button is pressed.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => tool.run(editor)}
              className={buttonClasses(on)}
            >
              <Icon aria-hidden="true" className="size-4" />
            </button>
          );
        })}
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          aria-label="Add link"
          aria-pressed={state.link}
          title="Add link"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={openLink}
          className={buttonClasses(state.link)}
        >
          <LinkIcon aria-hidden="true" className="size-4" />
        </button>
        {state.link ? (
          <button
            type="button"
            aria-label="Remove link"
            title="Remove link"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
            className={buttonClasses(false)}
          >
            <Unlink aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
      {linking ? (
        <div className="flex items-center gap-1.5">
          <input
            type="url"
            aria-label="Link address"
            aria-invalid={problem || undefined}
            placeholder="https://example.com"
            value={address}
            autoFocus
            onChange={(event) => {
              setAddress(event.target.value);
              setProblem(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyLink();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setLinking(false);
                editor.commands.focus();
              }
            }}
            className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-surface px-2 text-xs aria-invalid:border-danger focus-visible:border-primary"
          />
          <button
            type="button"
            onClick={applyLink}
            className="h-7 rounded-sm bg-primary px-2.5 text-xs font-semibold text-primary-fg hover:opacity-90"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setLinking(false);
              editor.commands.focus();
            }}
            className="h-7 rounded-sm px-2 text-xs font-medium text-text-muted hover:bg-surface-hover"
          >
            Cancel
          </button>
        </div>
      ) : null}
      {linking && problem ? (
        <p role="alert" className="text-xs font-medium text-danger">
          Enter a web address (https://…) or an email link (mailto:…).
        </p>
      ) : null}
    </div>
  );
}

/**
 * A rich text box: bold, italic, underline, strikethrough, lists, quotes, code and links, with
 * the auto-formatting people expect while they type (`**bold**`, `- ` and `1. ` lists, `> ` quotes,
 * `# ` headings, backticks, links recognised as they are typed or pasted). Reports the HTML and its
 * plain text. A screenshot or file pasted or dropped into it goes to `onFiles`.
 */
export function RichTextEditor({
  label,
  hideLabel,
  ariaLabel,
  error,
  hint,
  required = false,
  value,
  onChange,
  placeholder,
  onFiles,
  onSubmitShortcut,
  onEscape,
  disabled = false,
  areaClassName = 'min-h-28',
  autoFocus = false,
  className,
}: RichTextEditorProps) {
  const generatedId = useId();
  const ids = fieldIds(generatedId);
  // The editor is made once; its handlers read the latest props from here.
  const latest = useRef({ onChange, onFiles, onSubmitShortcut, onEscape });
  useEffect(() => {
    latest.current = { onChange, onFiles, onSubmitShortcut, onEscape };
  });
  // Every value the editor reported that the parent has not handed back yet. When a value comes back
  // it is an echo of the person's own typing; anything else is a change from outside.
  const echoes = useRef<string[]>([]);

  // Stable options: a new object on every render would make the editor re-apply them (and move
  // the caret) after each keystroke the parent reacts to.
  const [initialContent] = useState(value);
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        horizontalRule: false,
        dropcursor: { color: 'var(--color-primary)' },
      }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ['mailto'],
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    [placeholder],
  );
  const editorProps = useMemo(
    () => ({
      attributes: {
        id: ids.inputId,
        role: 'textbox',
        'aria-multiline': 'true',
        ...(required ? { 'aria-required': 'true' } : {}),
        'aria-labelledby': `${ids.inputId}-label`,
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        class: cn(
          'rich-text px-3 py-2.5 text-base text-text outline-none md:text-xs',
          areaClassName,
        ),
      },
      handlePaste: (_view: unknown, event: ClipboardEvent) => {
        const files = filesOfClipboard(event.clipboardData);
        if (files.length === 0 || !latest.current.onFiles) return false;
        event.preventDefault();
        latest.current.onFiles(files);
        return true;
      },
      handleDrop: (_view: unknown, event: DragEvent) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length === 0 || !latest.current.onFiles) return false;
        event.preventDefault();
        latest.current.onFiles(files);
        return true;
      },
    }),
    [ids.inputId, ariaLabel, areaClassName, required],
  );
  const onUpdate = useCallback(({ editor: current }: { editor: Editor }) => {
    const html = current.isEmpty ? '' : current.getHTML();
    echoes.current.push(html);
    if (echoes.current.length > 200) echoes.current.shift();
    latest.current.onChange({ html, text: current.getText({ blockSeparator: '\n' }).trim() });
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? 'end' : false,
    editable: !disabled,
    content: initialContent,
    extensions,
    editorProps,
    onUpdate,
  });

  // A value set from outside (the box cleared after sending, a draft restored) replaces the content.
  // The parent may hand back an older value than the one on screen when typing outpaces React,
  // so a value the editor reported itself is never applied again.
  useEffect(() => {
    if (!editor) return;
    const echoed = echoes.current.indexOf(value);
    if (echoed !== -1) {
      echoes.current.splice(0, echoed + 1);
      return;
    }
    const shown = editor.isEmpty ? '' : editor.getHTML();
    if (value === shown) return;
    echoes.current = [];
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { onSubmitShortcut: submit, onEscape: escape } = latest.current;
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && submit) {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape' && escape) {
      event.preventDefault();
      event.stopPropagation();
      escape();
    }
  };

  return (
    <Field
      ids={{ ...ids, inputId: `${ids.inputId}-label-target` }}
      label={<span id={`${ids.inputId}-label`}>{label}</span>}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <div
        onKeyDown={onKeyDown}
        aria-describedby={describedBy(ids, hint, error)}
        className={cn(
          'overflow-hidden rounded-md border border-border bg-surface transition-[border-color] duration-fast ease-standard',
          'hover:border-border-strong focus-within:border-primary',
          error && 'border-danger',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {editor ? <Toolbar editor={editor} disabled={disabled} /> : null}
        <EditorContent editor={editor} />
      </div>
    </Field>
  );
}
