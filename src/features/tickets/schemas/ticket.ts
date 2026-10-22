import * as z from 'zod';

import { DESCRIPTION_MAX_LENGTH, SUBJECT_MAX_LENGTH } from '../constants';

/** What the "new ticket" form holds; the tags are chosen outside the form fields. */
export const ticketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, 'Enter a subject')
    .max(SUBJECT_MAX_LENGTH, `Use at most ${String(SUBJECT_MAX_LENGTH)} characters`),
  description: z.string().max(DESCRIPTION_MAX_LENGTH, 'Use at most 10,000 characters'),
  status: z.enum([
    'open',
    'in_progress',
    'requirement_pending',
    'clarification_required',
    'blocked',
    'ready_for_ba_review',
    'reopened',
    'closed',
    'invalid',
    'on_hold',
  ]),
  priority: z.enum(['high', 'medium', 'low', 'not_set']),
});
export type TicketValues = z.infer<typeof ticketSchema>;

/** A text edited in place (subject or description): the same limits as the form. */
export const subjectText = ticketSchema.shape.subject;
export const descriptionText = ticketSchema.shape.description;

/** The "new ticket" form: as the edit form, but the description is required. */
export const createTicketSchema = ticketSchema.extend({
  description: z
    .string()
    .trim()
    .min(1, 'Enter a description')
    .max(DESCRIPTION_MAX_LENGTH, 'Use at most 10,000 characters'),
});
