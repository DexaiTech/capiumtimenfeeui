import type { BadgeTone } from '@/components/ui';
import { formatUkDate } from '@/utils/dates';

import { ORIGIN_LABEL } from '../constants';
import type { LadderStep } from '../types';
import { formatPeriod } from './format';

export interface StepState {
  tone: BadgeTone;
  label: string;
}

/**
 * Where a level stands for the question asked: it won, it exists but a more specific level won,
 * nothing is set at it, or the question does not give it what it needs (a job for the job rate).
 */
export function stepState(step: LadderStep): StepState {
  if (step.selected) return { tone: 'success', label: 'Applied' };
  if (!step.applicable) return { tone: 'grey', label: 'Not applicable' };
  if (step.exists) return { tone: 'info', label: 'Overridden' };
  return { tone: 'grey', label: 'No rate set' };
}

/** What a level is made of: the kind of rate and the period of the dated rate behind it, or why it does not apply. */
export function stepDetail(step: LadderStep): string {
  if (!step.applicable)
    return step.reason ?? 'The question does not give this level what it needs.';
  if (!step.exists) return '';
  const origin = step.origin ? (ORIGIN_LABEL[step.origin] ?? step.origin) : '';
  if (step.rule) {
    return `${origin} · ${formatPeriod(step.rule.effective_from, step.rule.effective_to)}`;
  }
  return origin;
}

/** "from 01/06/2026 to 31/12/2026" for the rule behind a step, or nothing. */
export function stepPeriod(step: LadderStep | undefined): string {
  if (!step?.rule) return '';
  const { effective_from: from, effective_to: to } = step.rule;
  return to ? `from ${formatUkDate(from)} to ${formatUkDate(to)}` : `from ${formatUkDate(from)}`;
}
