/**
 * Public surface of the Billing feature (`/:orgSlug/billing/*`). The router loads the pages from
 * `pages/`; other modules take the invoice preparation panel below instead of reaching into this
 * folder (the client's Invoices tab creates an invoice without leaving the client).
 */
export { PrepareInvoicePanel } from './components/prepare/PrepareInvoicePanel';
