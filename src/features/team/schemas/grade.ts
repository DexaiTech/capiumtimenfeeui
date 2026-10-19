import * as z from 'zod';

import {
  codeText,
  optionalPercentText,
  optionalRateText,
  textMax,
  wholeNumberText,
} from './common';

/** Create and edit a grade. Rates are typed in pounds per hour and the target as a percentage. */
export const gradeSchema = z.object({
  code: codeText(12, 'Enter a code for the grade'),
  name: z.string().trim().min(1, 'Enter the grade name').max(80, 'Use at most 80 characters'),
  description: textMax(500),
  default_cost_rate: optionalRateText('Enter a rate in pounds per hour, for example 45.00'),
  default_charge_rate: optionalRateText('Enter a rate in pounds per hour, for example 120.00'),
  target_percent: optionalPercentText,
  sort_order: wholeNumberText(0, 10_000, 'Enter a whole number from 0 to 10000'),
});
export type GradeValues = z.infer<typeof gradeSchema>;
