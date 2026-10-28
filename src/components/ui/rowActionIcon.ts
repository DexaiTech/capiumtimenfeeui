import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  Ban,
  Banknote,
  CalendarX,
  CircleCheck,
  CircleX,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileMinus2,
  History,
  KeyRound,
  Mail,
  Paperclip,
  Pencil,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
  Star,
  Trash2,
  Undo2,
  UserCheck,
  UserPlus,
  UserX,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';

/** What an action is called -> its icon. The first rule whose pattern matches the id or the label
 * wins, so the specific ones come first. */
const RULES: ReadonlyArray<readonly [RegExp, LucideIcon]> = [
  [/credit ?note/, FileMinus2],
  [/record payment|^pay\b|payment/, Banknote],
  [/history|audit|timeline/, History],
  [/\bcorrect/, PencilLine],
  [/record (time|entry)|log time/, Clock],
  [/sync|refresh|reload/, RefreshCw],
  [/settings|preferences|configure/, Settings2],
  [/\b(view|open|see|show|preview|details)\b/, Eye],
  [/end.?date|\bend\b/, CalendarX],
  [/reopen|restart/, RotateCcw],
  [/recall|undo|return|reverse|revert|unapprove|unmatch|unallocate/, Undo2],
  [/reject|decline|refuse/, CircleX],
  [/approve|accept|confirm|mark .*(paid|done)/, CircleCheck],
  [/\bvoid\b|cancel|disable/, Ban],
  [/issue|finali[sz]e/, FileCheck],
  [/remind|chase|\bemail\b|\bmail\b/, Mail],
  [/\bsend\b|submit|resend/, Send],
  [/download|\bpdf\b|export|statement/, Download],
  [/receipt|attach|file/, Paperclip],
  [/duplicate|copy|clone/, Copy],
  [/default/, Star],
  [/archive/, Archive],
  [/restore|unarchive/, ArchiveRestore],
  [/deactivate|suspend|leave/, UserX],
  [/activate|reactivate/, UserCheck],
  [/reset|password/, KeyRound],
  [/assign|invite|add (person|member|staff)/, UserPlus],
  [/transfer|move|swap/, ArrowLeftRight],
  [/delete|remove|discard|trash/, Trash2],
  [/edit|rename|change|update|modify|manage/, Pencil],
  [/inspect|read/, Eye],
  [/link|go to|visit/, ExternalLink],
];

/** The icon of a row action, from what it is called. */
export function rowActionIcon(id: string, label: string): LucideIcon {
  const text = `${id.replaceAll(/[-_]/g, ' ')} ${label}`.toLowerCase();
  for (const [pattern, icon] of RULES) {
    if (pattern.test(text)) return icon;
  }
  return ArrowUpRight;
}
