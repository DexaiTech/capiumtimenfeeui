/**
 * The response envelope shared by every endpoint (`app/schemas/common.py`):
 * `{success, data, message, meta}` on success, `{success: false, error}` on failure.
 */

/** Pagination metadata of cursor-paginated list endpoints (`limit`, `cursor`, `meta.next_cursor`). */
export interface PageMeta {
  next_cursor: string | null;
  has_more: boolean;
}

export interface SuccessEnvelope<TData, TMeta = PageMeta | null> {
  success: true;
  data: TData;
  message: string | null;
  meta: TMeta;
}

export interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string | null;
}

export interface ErrorEnvelope {
  success: false;
  error: ErrorBody;
}

export type Envelope<TData, TMeta = PageMeta | null> =
  SuccessEnvelope<TData, TMeta> | ErrorEnvelope;

/** One entry of `error.details` for a 422 VALIDATION_ERROR. */
export interface FieldErrorDetail {
  field: string;
  code?: string;
  message: string;
}

/** Query parameters of every cursor-paginated list. */
export interface PageParams {
  limit?: number;
  cursor?: string;
}

/** A page of a cursor-paginated list as the client returns it. */
export interface Page<TItem> {
  data: TItem[];
  meta: PageMeta;
}

/** Money in minor units (pence) of the practice currency. Never a float. */
export type Pence = number;
/** A duration in whole minutes. */
export type Minutes = number;
/** A VAT rate or percentage in basis points: 2000 = 20.00%. */
export type BasisPoints = number;
/** An ISO date, `YYYY-MM-DD`, in the practice's time zone. */
export type IsoDate = string;
/** An ISO 8601 UTC timestamp. */
export type IsoDateTime = string;
