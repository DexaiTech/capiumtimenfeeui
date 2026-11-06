import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { Reorder, useDragControls } from 'motion/react';
import { useEffect, useId, useRef, useState, type BaseSyntheticEvent } from 'react';

import { FormAlert, type SubmitError } from '@/components/forms';
import { Button, ConfirmDialog, Switch, useToast } from '@/components/ui';
import { isApiError } from '@/services/api';
import {
  WIP_VALUATION_SOURCES,
  type WipValuationPreview,
  type WipValuationSource,
} from '@/types/organization';
import { formatMoney } from '@/utils/money';

import { useSaveWipValuation, useWipValuationPreview } from '../../api/wipValuationHooks';
import { WIP_VALUATION_SOURCE_META } from '../../utils/general';
import { SettingsCard } from './SettingsCard';
import type { GeneralCardProps } from './types';

const LAST_SOURCE = 'Keep at least one rate switched on.';

function toSubmitError(error: unknown): SubmitError {
  return isApiError(error)
    ? { message: error.message, requestId: error.requestId, code: error.code }
    : { message: 'Something went wrong. Please try again.' };
}

/** "3 billed, 1 in a draft invoice": the entries a re-value leaves as they are. */
function skippedText(skipped: WipValuationPreview['skipped']): string {
  const parts = [
    [skipped.billed, 'billed'],
    [skipped.in_draft, 'in a draft invoice'],
    [skipped.locked, 'in a locked period'],
    [skipped.written_off, 'written off'],
  ] as const;
  return parts
    .filter(([count]) => count > 0)
    .map(([count, what]) => `${String(count)} ${what}`)
    .join(', ');
}

interface RowProps {
  source: WipValuationSource;
  id: string;
  /** 1-based priority. */
  position: number;
  count: number;
  editable: boolean;
  onMove: (step: -1 | 1) => void;
  onToggle: () => void;
}

/** An enabled rate: drag handle, up and down (the keyboard's way to reorder), priority, switch. */
function EnabledRow({ source, id, position, count, editable, onMove, onToggle }: RowProps) {
  const controls = useDragControls();
  const { label, description } = WIP_VALUATION_SOURCE_META[source];
  return (
    <Reorder.Item
      value={source}
      id={id}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1"
    >
      {editable ? (
        <>
          <span
            aria-hidden="true"
            title="Drag to reorder"
            onPointerDown={(event) => controls.start(event)}
            className="flex cursor-grab touch-none items-center text-text-muted active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </span>
          <Button
            id={`${id}-up`}
            size="icon-sm"
            variant="ghost"
            aria-label={`Move ${label} up`}
            disabled={position === 1}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </Button>
          <Button
            id={`${id}-down`}
            size="icon-sm"
            variant="ghost"
            aria-label={`Move ${label} down`}
            disabled={position === count}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </Button>
        </>
      ) : null}
      <span className="w-5 shrink-0 text-center text-sm font-semibold text-brand-text tabular-nums">
        {position}
      </span>
      <Switch
        checked
        onChange={onToggle}
        disabled={!editable}
        label={label}
        description={description}
        className="min-w-0 flex-1"
      />
    </Reorder.Item>
  );
}

/**
 * Which rates value work in progress and the order they are tried in (APT84): the enabled rates,
 * numbered by priority and reordered by dragging or with up and down, and below them the rates
 * not used. At least one stays on. Saving previews what it changes and, when unbilled time would
 * change, asks before re-valuing it.
 */
export function WipValuationCard({ organization, editable }: GeneralCardProps) {
  const saved = organization.wip_valuation_sources;
  const [draft, setDraft] = useState<WipValuationSource[] | null>(null);
  const [guard, setGuard] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [impact, setImpact] = useState<WipValuationPreview | null>(null);
  const [dialogError, setDialogError] = useState<SubmitError | null>(null);
  const preview = useWipValuationPreview();
  const save = useSaveWipValuation();
  const { toast } = useToast();
  const idBase = useId();
  const rowId = (source: WipValuationSource) => `${idBase}-${source}`;
  // Moving or switching a row re-mounts or moves it: focus follows the control that was used.
  const focusNext = useRef<{ id: string; fallback: string } | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    const element = document.getElementById(target.id);
    if (element instanceof HTMLButtonElement && !element.disabled) element.focus();
    else
      document
        .getElementById(target.fallback)
        ?.querySelector<HTMLElement>('[role="switch"]')
        ?.focus();
  });

  const enabled = draft ?? saved;
  const unused = WIP_VALUATION_SOURCES.filter((source) => !enabled.includes(source));
  const dirty = draft !== null && draft.join() !== saved.join();

  const change = (next: WipValuationSource[]) => {
    setGuard(false);
    setDraft(next);
  };
  const move = (index: number, step: -1 | 1) => {
    const source = enabled[index];
    if (!source) return;
    const next = enabled.filter((_, at) => at !== index);
    next.splice(index + step, 0, source);
    focusNext.current = {
      id: `${rowId(source)}-${step === -1 ? 'up' : 'down'}`,
      fallback: rowId(source),
    };
    change(next);
  };
  const toggle = (source: WipValuationSource) => {
    if (enabled.includes(source)) {
      if (enabled.length === 1) {
        setGuard(true);
        return;
      }
      focusNext.current = { id: '', fallback: rowId(source) };
      change(enabled.filter((item) => item !== source));
    } else {
      focusNext.current = { id: '', fallback: rowId(source) };
      change([...enabled, source]);
    }
  };

  const saveOrder = (revalue: boolean) => {
    save.mutate(
      { sources: enabled, revalue },
      {
        onSuccess: () => {
          setImpact(null);
          setDraft(null);
          toast({ tone: 'success', title: 'WIP valuation saved' });
        },
        onError: (error) => {
          if (impact) setDialogError(toSubmitError(error));
          else setSubmitError(toSubmitError(error));
        },
      },
    );
  };

  const onSubmit = (event?: BaseSyntheticEvent) => {
    event?.preventDefault();
    setSubmitError(null);
    setDialogError(null);
    return preview.mutateAsync(enabled).then(
      (result) => {
        if (result.entries_changed > 0) setImpact(result);
        else saveOrder(false);
      },
      (error: unknown) => setSubmitError(toSubmitError(error)),
    );
  };

  const discard = () => {
    setDraft(null);
    setGuard(false);
    setSubmitError(null);
  };

  const currency = organization.currency;
  const skipped = impact ? skippedText(impact.skipped) : '';
  const entries = (count: number) => (count === 1 ? '1 entry' : `${String(count)} entries`);

  return (
    <>
      <SettingsCard
        title="WIP valuation"
        description="Choose which rates value your work in progress, and the order they are tried in. The first enabled rate that applies is used."
        saveLabel="Save WIP valuation"
        editable={editable}
        dirty={dirty}
        saving={preview.isPending || save.isPending}
        retryIn={0}
        submitError={submitError}
        onSubmit={onSubmit}
        onDiscard={discard}
      >
        <Reorder.Group
          as="ol"
          axis="y"
          values={enabled}
          onReorder={change}
          aria-label="Rates used, in priority order"
          className="flex flex-col gap-2"
        >
          {enabled.map((source, index) => (
            <EnabledRow
              key={source}
              source={source}
              id={rowId(source)}
              position={index + 1}
              count={enabled.length}
              editable={editable}
              onMove={(step) => move(index, step)}
              onToggle={() => toggle(source)}
            />
          ))}
        </Reorder.Group>
        {guard ? <FormAlert message={LAST_SOURCE} /> : null}
        {unused.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 id={`${idBase}-unused`} className="text-sm font-medium text-text-muted">
              Not used
            </h3>
            <ul aria-labelledby={`${idBase}-unused`} className="flex flex-col gap-2">
              {unused.map((source) => (
                <li
                  key={source}
                  id={rowId(source)}
                  className="rounded-md border border-border bg-surface-sunken px-2 py-1 opacity-60"
                >
                  <Switch
                    checked={false}
                    onChange={() => toggle(source)}
                    disabled={!editable}
                    label={WIP_VALUATION_SOURCE_META[source].label}
                    description={WIP_VALUATION_SOURCE_META[source].description}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SettingsCard>
      <ConfirmDialog
        open={impact !== null}
        onClose={() => {
          setImpact(null);
          setDialogError(null);
        }}
        onConfirm={() => saveOrder(!impact?.too_many)}
        title={impact?.too_many ? 'Save without re-valuing?' : 'Re-value work in progress?'}
        confirmLabel={impact?.too_many ? 'Save without re-valuing' : 'Re-value and save'}
        tone="default"
        loading={save.isPending}
        error={dialogError}
      >
        {impact ? (
          <>
            <p>
              {impact.too_many
                ? `${entries(impact.entries_changed)} of unbilled time would change, more than can be re-valued here. Save the order now, then re-value past time in Team & Rates → Change Rates on Past Time.`
                : `${entries(impact.entries_changed)} of unbilled time will be re-valued at the new order.`}
            </p>
            {impact.too_many ? null : (
              <>
                <p className="font-medium text-text">
                  WIP {formatMoney(impact.wip_before, currency)} →{' '}
                  {formatMoney(impact.wip_after, currency)}
                </p>
                {skipped ? <p>Not changed: {skipped}.</p> : null}
              </>
            )}
          </>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
