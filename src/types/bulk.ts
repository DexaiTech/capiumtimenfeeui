/** The answer of a bulk endpoint (`POST /jobs/bulk`, `/clients/bulk`, `/invoices/bulk`). */
export interface BulkResult<TAction extends string = string> {
  action: TAction;
  /** Distinct rows the action was applied to (the selection). */
  affected: number;
  /** Of those, the rows that actually changed (one already in the wanted state does not). */
  changed: number;
}
