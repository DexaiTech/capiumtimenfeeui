import { Plus } from 'lucide-react';
import { useRef, useState, type ReactNode, type SubmitEvent } from 'react';

import { Button, Checkbox, Popover, Spinner, useToast } from '@/components/ui';
import { isApiError } from '@/services/api';

import { useCreateTicketTag, useTicketTags, useToggleTicketTag } from '../api';
import { TAG_NAME_MAX_LENGTH } from '../constants';
import type { TagRef, TicketListItem } from '../types';
import { describeFailure } from '../utils/errors';
import { TagChip } from './TagChip';

export interface TagPopoverProps {
  ticket: Pick<TicketListItem, 'id' | 'code' | 'tags'>;
  /** The trigger button's content. */
  trigger: ReactNode;
  /** The trigger's accessible name, for example "Edit tags of APT271". */
  label: string;
  triggerClassName?: string;
  /** Hands a sentence to a live region once a tag was added or taken off. */
  onResult?: (message: string) => void;
}

/**
 * Adds and removes the tags of one ticket: a popover with the practice's tags as checkboxes and
 * a field that finds them or creates a new one. Every tick is one bulk call (`add_tag` or
 * `remove_tag`), applied at once and put back with a toast when the API refuses it. Only offer
 * it to people with `ticket.update`.
 */
export function TagPopover({
  ticket,
  trigger,
  label,
  triggerClassName,
  onResult,
}: TagPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tags = useTicketTags();
  const { mutate: toggle } = useToggleTicketTag();
  const create = useCreateTicketTag();
  const { toast } = useToast();

  const chosen = new Set(ticket.tags.map((tag) => tag.id));
  const term = query.trim();
  const needle = term.toLowerCase();
  const all = tags.data ?? [];
  const visible = needle ? all.filter((tag) => tag.name.toLowerCase().includes(needle)) : all;
  const exists = all.some((tag) => tag.name.toLowerCase() === needle);

  const close = () => {
    setOpen(false);
    setQuery('');
    setProblem(null);
  };

  const flip = (tag: TagRef, add: boolean) => {
    toggle(
      { ticketId: ticket.id, tag, add },
      {
        onSuccess: () =>
          onResult?.(
            add
              ? `Tag ${tag.name} added to ${ticket.code}`
              : `Tag ${tag.name} taken off ${ticket.code}`,
          ),
        onError: (error) =>
          toast({
            tone: 'error',
            ...describeFailure(error, `Could not change the tags of ${ticket.code}`),
          }),
      },
    );
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!term || exists || create.isPending) return;
    setProblem(null);
    create.mutate(
      { name: term },
      {
        onSuccess: (tag) => {
          setQuery('');
          flip({ id: tag.id, name: tag.name, color: tag.color }, true);
        },
        onError: (error) =>
          setProblem(isApiError(error) ? error.message : 'Could not create the tag.'),
      },
    );
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <Popover
        open={open}
        onClose={close}
        anchorRef={anchorRef}
        label={`Tags of ${ticket.code}`}
        className="w-72"
      >
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <div className="border-b border-border">
            <input
              type="text"
              autoFocus
              autoComplete="off"
              aria-label="Find or create a tag"
              placeholder="Find or create a tag…"
              maxLength={TAG_NAME_MAX_LENGTH}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setProblem(null);
              }}
              className="h-11 w-full bg-transparent px-3 text-base text-text placeholder:text-text-subtle md:h-8 md:text-xs"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {tags.isPending ? (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : tags.isError ? (
              <div className="flex flex-col items-start gap-2 px-2.5 py-3 text-xs text-text-muted">
                <p>Could not load the tags.</p>
                <Button size="sm" onClick={() => void tags.refetch()}>
                  Try again
                </Button>
              </div>
            ) : visible.length === 0 ? (
              <p className="px-2.5 py-3 text-xs text-text-muted">
                {all.length === 0 ? 'No tags yet. Type a name to create one.' : 'No tag matches.'}
              </p>
            ) : (
              <ul className="flex flex-col">
                {visible.map((tag) => (
                  <li key={tag.id}>
                    <Checkbox
                      label={<TagChip tag={tag} />}
                      checked={chosen.has(tag.id)}
                      onChange={(event) =>
                        flip({ id: tag.id, name: tag.name, color: tag.color }, event.target.checked)
                      }
                      className="px-2"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          {problem ? (
            <p role="alert" className="px-3.5 pb-2 text-xs font-medium text-danger">
              {problem}
            </p>
          ) : null}
          {term && !exists ? (
            <div className="border-t border-border p-1.5">
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                loading={create.isPending}
                leftIcon={<Plus aria-hidden="true" className="size-3.5" />}
                className="w-full justify-start text-brand-text"
              >
                Create “{term}”
              </Button>
            </div>
          ) : null}
        </form>
      </Popover>
    </>
  );
}
