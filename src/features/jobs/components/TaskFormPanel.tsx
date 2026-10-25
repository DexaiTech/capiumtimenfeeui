import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormAlert, useSubmitError } from '@/components/forms';
import {
  AddAnotherButton,
  Button,
  DateField,
  DurationInput,
  Input,
  FormPanel,
  SegmentedControl,
  Select,
  Textarea,
  useAddAnother,
  useToast,
  type SelectOption,
} from '@/components/ui';

import { useCreateTask, useUpdateTask } from '../api';
import { LIMITS, TASK_STATUS_META } from '../constants';
import {
  taskDefaults,
  taskSchema,
  toTaskInput,
  toTaskUpdate,
  type TaskValues,
} from '../schemas/task';
import { TASK_STATUSES, type Job, type Task } from '../types';
import { toFormError } from '../utils/errors';
import { AssigneePicker } from './AssigneePicker';
import { DialogActions } from './DialogActions';
import { TasksBulkAddForm } from './TasksBulkAddForm';

const FIELDS = ['title', 'description', 'due_date', 'budget_minutes', 'status'] as const;

const STATUS_OPTIONS: ReadonlyArray<SelectOption> = TASK_STATUSES.map((status) => ({
  value: status,
  label: TASK_STATUS_META[status].label,
}));

export interface TaskFormPanelProps {
  open: boolean;
  onClose: () => void;
  job: Job;
  /** The task to edit; null adds a new one. */
  task: Task | null;
}

interface TaskFormProps extends Omit<TaskFormPanelProps, 'open'> {
  formId: string;
}

function TaskForm({ job, task, onClose, formId }: TaskFormProps) {
  const { toast } = useToast();
  const create = useCreateTask();
  const update = useUpdateTask();
  const [assignees, setAssignees] = useState<string[]>([]);
  const again = useAddAnother();
  const schema = useMemo(
    () => taskSchema({ jobStart: job.start_date, jobDue: job.due_date }),
    [job.start_date, job.due_date],
  );
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    setFocus,
    getValues,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<TaskValues>({ resolver: zodResolver(schema), defaultValues: taskDefaults(task) });
  const { submitError, retryIn, handleSubmitError, clearSubmitError } = useSubmitError<TaskValues>({
    setError,
    fields: FIELDS,
  });
  const budgetMinutes = useWatch({ control, name: 'budget_minutes' });

  const onSubmit = handleSubmit((values) => {
    clearSubmitError();
    const onError = (error: unknown) => handleSubmitError(toFormError(error));
    if (!task) {
      create.mutate(
        { jobId: job.id, body: toTaskInput(values, assignees) },
        {
          onSuccess: () => {
            toast({ tone: 'success', title: 'Task added', description: values.title });
            if (again.consume()) {
              // Keep the due date, status and people: a run of tasks usually shares them.
              reset({ ...getValues(), title: '', description: '' });
              // reset() unregisters the fields until the next render, so focus after it.
              setTimeout(() => setFocus('title'), 0);
              return;
            }
            onClose();
          },
          onError,
        },
      );
      return;
    }
    const body = toTaskUpdate(values, task);
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { jobId: job.id, taskId: task.id, body },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Task saved', description: values.title });
          onClose();
        },
        onError,
      },
    );
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Input
          label="Title"
          required
          autoComplete="off"
          maxLength={LIMITS.taskTitle}
          error={errors.title?.message}
          {...register('title')}
        />
        <Textarea
          label="Description"
          rows={2}
          maxLength={LIMITS.taskDescription}
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="due_date"
            render={({ field }) => (
              <DateField
                label="Due date"
                value={field.value || null}
                min={job.start_date}
                max={job.due_date}
                onChange={(value) => field.onChange(value ?? '')}
                error={errors.due_date?.message}
              />
            )}
          />
          <DurationInput
            label="Hours budget"
            value={budgetMinutes}
            hint="For example 8:00 or 2.5"
            error={errors.budget_minutes?.message}
            onCommit={(minutes) =>
              setValue('budget_minutes', minutes, { shouldDirty: true, shouldValidate: true })
            }
          />
        </div>
        {task ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Starts as"
              options={STATUS_OPTIONS}
              error={errors.status?.message}
              {...register('status')}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text">Assigned to</span>
              <AssigneePicker
                label="Assignees of the new task"
                value={assignees}
                onChange={setAssignees}
              />
            </div>
          </div>
        )}
        {submitError ? (
          <FormAlert message={submitError.message} requestId={submitError.requestId} />
        ) : null}
      </form>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {task ? null : (
          <AddAnotherButton
            formId={formId}
            flagRef={again.flagRef}
            loading={create.isPending}
            disabled={retryIn > 0}
          />
        )}
        <Button
          type="submit"
          form={formId}
          {...again.primaryProps}
          variant="primary"
          loading={create.isPending || update.isPending}
          disabled={(task !== null && !isDirty) || retryIn > 0}
        >
          {task ? 'Save task' : 'Add task'}
        </Button>
      </DialogActions>
    </>
  );
}

/** Add a task to a job, or change the title, description, due date and budget of one. */
export function TaskFormPanel({ open, onClose, ...rest }: TaskFormPanelProps) {
  const formId = useId();
  const [several, setSeveral] = useState(false);
  const adding = rest.task === null;
  const close = () => {
    setSeveral(false);
    onClose();
  };
  return (
    <FormPanel
      open={open}
      onClose={close}
      title={adding ? (several ? 'Add several tasks' : 'Add task') : 'Edit task'}
      description={rest.job.name}
    >
      {open ? (
        <div className="flex flex-col gap-4">
          {adding ? (
            <SegmentedControl
              label="How many tasks"
              options={[
                { value: 'one', label: 'One task' },
                { value: 'several', label: 'Several tasks' },
              ]}
              value={several ? 'several' : 'one'}
              onChange={(value) => setSeveral(value === 'several')}
              className="self-start"
            />
          ) : null}
          {adding && several ? (
            <TasksBulkAddForm job={rest.job} formId={formId} onClose={close} />
          ) : (
            <TaskForm key={rest.task?.id ?? 'new'} formId={formId} onClose={close} {...rest} />
          )}
        </div>
      ) : null}
    </FormPanel>
  );
}
