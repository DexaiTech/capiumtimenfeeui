import { downloadText, toCsv } from '@/utils/csv';

import { IMPORT_TEMPLATE_COLUMNS, IMPORT_TEMPLATE_EXAMPLE } from './constants';

/** The CSV template: the mapped header row and one example client. */
export function downloadImportTemplate() {
  downloadText(
    'clients-import-template.csv',
    toCsv([
      [...IMPORT_TEMPLATE_COLUMNS],
      IMPORT_TEMPLATE_COLUMNS.map((column) => IMPORT_TEMPLATE_EXAMPLE[column]),
    ]),
  );
}
