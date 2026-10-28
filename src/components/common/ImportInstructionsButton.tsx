import { FileQuestion } from 'lucide-react';

import { Button } from '@/components/ui';
import { downloadImportInstructions, type ImportSheet } from '@/utils/importInstructions';

export interface ImportInstructionsButtonProps {
  sheet: ImportSheet;
}

/** "Download instructions": a spreadsheet that explains every column of the import file. */
export function ImportInstructionsButton({ sheet }: ImportInstructionsButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      leftIcon={<FileQuestion className="size-4" aria-hidden="true" />}
      onClick={() => downloadImportInstructions(sheet)}
    >
      Download instructions
    </Button>
  );
}
