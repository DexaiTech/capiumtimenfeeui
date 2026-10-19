import type { Organization } from '@/features/organizations';

/**
 * Whether an invoice has to be approved before it is issued: the practice's
 * `invoice_approval_required` switch and its `invoice_approval_threshold` (gross pence; 0 = every
 * invoice). The API enforces it (409 `INVOICE_APPROVAL_REQUIRED`); the screen uses it to offer
 * "Submit for approval" instead of "Issue".
 */
export interface ApprovalPolicy {
  required: boolean;
  /** Gross pence from which approval is needed; 0 means every invoice. */
  threshold: number;
}

/** Read defensively: the practice object carries the settings, its declared type may not. */
export function approvalPolicyOf(organization: Organization): ApprovalPolicy {
  const record = organization as unknown as Record<string, unknown>;
  const threshold = record.invoice_approval_threshold;
  return {
    required: record.invoice_approval_required === true,
    threshold: typeof threshold === 'number' ? threshold : 0,
  };
}

/** Does an invoice of this gross total need approval before it can be issued? */
export function needsApproval(policy: ApprovalPolicy, gross: number): boolean {
  return policy.required && gross >= policy.threshold;
}
