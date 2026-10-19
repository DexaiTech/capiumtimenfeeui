import * as z from 'zod';

const pickerItem = z.object({ id: z.string(), label: z.string(), detail: z.string().optional() });

/**
 * The scope of a re-rate: clients, jobs and/or a date range (both dates), narrowed by staff.
 * At least clients, jobs or a date range is required, like the API.
 */
export const rerateScopeSchema = z
  .object({
    clients: z.array(pickerItem),
    jobs: z.array(pickerItem),
    staff: z.array(pickerItem),
    date_from: z.string(),
    date_to: z.string(),
  })
  .refine((values) => Boolean(values.date_from) === Boolean(values.date_to), {
    path: ['date_to'],
    message: 'Enter both dates of the range, or leave both empty',
  })
  .refine((values) => !values.date_from || !values.date_to || values.date_to >= values.date_from, {
    path: ['date_to'],
    message: "The end date can't be before the start date",
  })
  .refine(
    (values) =>
      values.clients.length > 0 ||
      values.jobs.length > 0 ||
      (values.date_from !== '' && values.date_to !== ''),
    { path: ['clients'], message: 'Choose clients, jobs or a date range' },
  );
export type RerateScopeValues = z.infer<typeof rerateScopeSchema>;

/** The scope form as the person fills it in: the schema's values and the preview option. */
export interface ScopeState extends RerateScopeValues {
  /** Also list the entries that would not change. */
  include_unchanged: boolean;
}

export const EMPTY_SCOPE: ScopeState = {
  clients: [],
  jobs: [],
  staff: [],
  date_from: '',
  date_to: '',
  include_unchanged: false,
};

/** The message of each field of the form that failed validation. */
export type ScopeErrors = Partial<Record<keyof RerateScopeValues, string>>;
