import { describe, expect, it } from 'vitest';

import { acme, globex, item } from '../test/fixtures';
import {
  componentOf,
  isTakeable,
  itemKey,
  transferProblem,
  transferRef,
  writeOffProblem,
  writeOffRef,
} from './items';

const disbursement = () =>
  item({ kind: 'disbursement', id: 'd-1', component: 'expense', value: 1300 });
const fee = () => item({ kind: 'fixed_fee', id: 'j-2', component: 'fixed_fee', selectable: false });

describe('what a write-off or a transfer may take', () => {
  it('takes time, disbursements and expenses that billing may select', () => {
    expect(isTakeable(item())).toBe(true);
    expect(isTakeable(disbursement())).toBe(true);
    expect(isTakeable(item({ kind: 'expense', id: 'e-1' }))).toBe(true);
    expect(isTakeable(fee())).toBe(false);
    expect(isTakeable(item({ kind: 'adjustment', id: 'a-1' }))).toBe(false);
    expect(isTakeable(item({ selectable: false }))).toBe(false);
  });

  it('refers to an item by exactly one id, as the API wants', () => {
    expect(writeOffRef(item({ id: 't-1' }))).toEqual({ time_entry_id: 't-1' });
    expect(writeOffRef(disbursement())).toEqual({ disbursement_id: 'd-1' });
    expect(writeOffRef(item({ kind: 'expense', id: 'e-1' }))).toEqual({ expense_id: 'e-1' });
    expect(transferRef(disbursement())).toEqual({ kind: 'disbursement', id: 'd-1' });
  });

  it('keys items of different kinds apart', () => {
    expect(itemKey(item({ id: 'x' }))).toBe('time:x');
    expect(itemKey(item({ kind: 'expense', id: 'x' }))).toBe('expense:x');
  });
});

describe('the WIP an item counts in', () => {
  it('counts a disbursement in the expense WIP', () => {
    expect(componentOf(item())).toBe('time');
    expect(componentOf(item({ kind: 'disbursement', component: null }))).toBe('expense');
    expect(componentOf(item({ kind: 'fixed_fee', component: null }))).toBe('fixed_fee');
    expect(componentOf(item({ kind: 'adjustment', component: null }))).toBeNull();
  });
});

describe('writeOffProblem', () => {
  it('needs items, and items of one client', () => {
    expect(writeOffProblem([])).toBe('Select the items to write off.');
    expect(writeOffProblem([item(), item({ id: 't-2', client: globex })])).toBe(
      'Select the items of one client to write them off.',
    );
    expect(writeOffProblem([item({ client: null })])).toBe(
      'Select the items of one client to write them off.',
    );
    expect(writeOffProblem([item(), item({ id: 't-2', client: acme })])).toBeNull();
  });
});

describe('transferProblem', () => {
  it('needs items of one job and of one kind of WIP', () => {
    expect(transferProblem([])).toBe('Select the items to transfer.');
    const other = { id: 'j-9', number: 'J00009', name: 'Other', billing_basis: 'hourly' };
    expect(transferProblem([item(), item({ id: 't-2', job: other })])).toBe(
      'Select the items of one job to transfer them.',
    );
    expect(transferProblem([item(), disbursement()])).toBe(
      'Select one kind of WIP to transfer: time, or expenses.',
    );
    expect(transferProblem([item(), item({ id: 't-2' })])).toBeNull();
  });
});
