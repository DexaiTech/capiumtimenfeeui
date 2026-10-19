import { describe, expect, it } from 'vitest';

import { job as makeJob, task as makeTask } from '../test/fixtures';
import { jobDefaults, jobSchema, toJobInput, toJobUpdate, type JobValues } from './job';
import { taskDefaults, taskSchema, toTaskInput, toTaskUpdate, type TaskValues } from './task';

const CLIENT = '0198c1f2-0000-7000-8000-0000000000c1';

const values = (overrides: Partial<JobValues> = {}): JobValues => ({
  ...jobDefaults(null, CLIENT),
  name: 'Audit 2026',
  ...overrides,
});

describe('the job form', () => {
  it('asks for a client and a name', () => {
    const result = jobSchema.safeParse(values({ client_id: '', name: '   ' }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Choose the client',
      'Enter the name of the job',
    ]);
  });

  it('refuses amounts it cannot read and dates the wrong way round', () => {
    const result = jobSchema.safeParse(
      values({
        budget_fee: 'lots',
        start_date: '2026-11-01',
        due_date: '2026-10-01',
        period_start: '2026-04-01',
        period_end: '2026-03-31',
      }),
    );
    expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ['budget_fee', 'Enter an amount in pounds, for example 1500.00'],
      ['due_date', 'The due date cannot be before the start date'],
      ['period_end', 'The period cannot end before it starts'],
    ]);
  });

  it('sends what was filled in and leaves the rest to the API defaults', () => {
    expect(toJobInput(values())).toEqual({
      client_id: CLIENT,
      name: 'Audit 2026',
      billing_basis: 'hourly',
      status: 'planned',
    });
    expect(
      toJobInput(
        values({
          description: 'Statutory audit',
          service_id: 'svc-1',
          billing_basis: 'fixed',
          fixed_fee: '1,500.50',
          hourly_rate: '99',
          budget_minutes: 2400,
          budget_fee: '2000',
          due_date: '2026-12-31',
          manager_user_id: 'u-1',
          status: 'in_progress',
        }),
      ),
    ).toEqual({
      client_id: CLIENT,
      name: 'Audit 2026',
      description: 'Statutory audit',
      service_id: 'svc-1',
      billing_basis: 'fixed',
      // The hourly rate belongs to an hourly job only.
      fixed_fee: 150050,
      budget_minutes: 2400,
      budget_fee: 200000,
      due_date: '2026-12-31',
      manager_user_id: 'u-1',
      status: 'in_progress',
    });
  });

  it('starts an edit from the job and sends only what changed, null clearing a value', () => {
    const job = makeJob({
      description: 'Old',
      fixed_fee: null,
      budget_fee: 50000,
      due_date: '2026-10-30',
    });
    expect(toJobUpdate(jobDefaults(job), job)).toEqual({});

    const edited = jobDefaults(job);
    edited.name = 'Renamed';
    edited.due_date = '';
    edited.budget_fee = '750.00';
    edited.description = '';
    expect(toJobUpdate(edited, job)).toEqual({
      name: 'Renamed',
      due_date: null,
      budget_fee: 75000,
      description: null,
    });
  });
});

describe('the task form', () => {
  const taskValues = (overrides: Partial<TaskValues> = {}): TaskValues => ({
    ...taskDefaults(null),
    title: 'Trial balance',
    ...overrides,
  });

  it('keeps the due date within the dates of the job', () => {
    const schema = taskSchema({ jobStart: '2026-10-01', jobDue: '2026-10-30' });
    expect(schema.safeParse(taskValues({ due_date: '2026-10-15' })).success).toBe(true);
    const late = schema.safeParse(taskValues({ due_date: '2026-11-02' }));
    expect(late.error?.issues[0]?.message).toBe(
      'The due date must be within the dates of the job (01/10/2026 - 30/10/2026)',
    );
    // A job without dates puts no limit on its tasks.
    expect(
      taskSchema({ jobStart: null, jobDue: null }).safeParse(taskValues({ due_date: '2030-01-01' }))
        .success,
    ).toBe(true);
  });

  it('asks for a title', () => {
    const result = taskSchema({ jobStart: null, jobDue: null }).safeParse(
      taskValues({ title: '' }),
    );
    expect(result.error?.issues[0]?.message).toBe('Enter the title of the task');
  });

  it('sends a new task with what was set and an edit with what changed', () => {
    expect(toTaskInput(taskValues(), [])).toEqual({
      title: 'Trial balance',
      status: 'not_started',
    });
    expect(
      toTaskInput(taskValues({ due_date: '2026-10-20', budget_minutes: 120, description: 'TB' }), [
        'u-1',
      ]),
    ).toEqual({
      title: 'Trial balance',
      status: 'not_started',
      description: 'TB',
      due_date: '2026-10-20',
      budget_minutes: 120,
      assignee_user_ids: ['u-1'],
    });

    const task = makeTask({ due_date: '2026-10-20', budget_minutes: 120 });
    expect(toTaskUpdate(taskDefaults(task), task)).toEqual({});
    expect(toTaskUpdate({ ...taskDefaults(task), title: 'New', due_date: '' }, task)).toEqual({
      title: 'New',
      due_date: null,
    });
  });
});
