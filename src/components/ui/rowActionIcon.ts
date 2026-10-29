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
  [/recall|undo|return|reverse|revert|revoke|unapprove|unmatch|unallocate/, Undo2],
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

function matchIcon(id: string, label: string): LucideIcon {
  const text = `${id.replaceAll(/[-_]/g, ' ')} ${label}`.toLowerCase();
  for (const [pattern, icon] of RULES) {
    if (pattern.test(text)) return icon;
  }
  return ArrowUpRight;
}

/** The icon of a row action, from what it is called. */
export function rowActionIcon(id: string, label: string): LucideIcon {
  return matchIcon(id, label);
}

export type RowActionColor = 'blue' | 'violet' | 'green' | 'amber' | 'orange' | 'red';

/** What each icon means, as a colour: look blue, change violet, done green, history amber, risky red. */
const COLORS = new Map<LucideIcon, RowActionColor>([
  [Eye, 'blue'],
  [ExternalLink, 'blue'],
  [ArrowUpRight, 'blue'],
  [Download, 'blue'],
  [Send, 'blue'],
  [RefreshCw, 'blue'],
  [Pencil, 'violet'],
  [PencilLine, 'violet'],
  [Settings2, 'violet'],
  [KeyRound, 'violet'],
  [UserPlus, 'violet'],
  [Banknote, 'green'],
  [CircleCheck, 'green'],
  [FileCheck, 'green'],
  [UserCheck, 'green'],
  [ArchiveRestore, 'green'],
  [Clock, 'amber'],
  [History, 'amber'],
  [Star, 'amber'],
  [RotateCcw, 'amber'],
  [Undo2, 'amber'],
  [Mail, 'amber'],
  [Archive, 'orange'],
  [CalendarX, 'orange'],
  [FileMinus2, 'orange'],
  [ArrowLeftRight, 'orange'],
  [Paperclip, 'orange'],
  [Copy, 'orange'],
  [Trash2, 'red'],
  [Ban, 'red'],
  [CircleX, 'red'],
  [UserX, 'red'],
]);

/** Written out in full so Tailwind finds every class: the icon's colour, and its hover tint. */
export const ROW_ACTION_CLASSES: Record<RowActionColor, string> = {
  blue: 'text-badge-blue hover:bg-badge-blue-soft',
  violet: 'text-badge-violet hover:bg-badge-violet-soft',
  green: 'text-badge-green hover:bg-badge-green-soft',
  amber: 'text-badge-amber hover:bg-badge-amber-soft',
  orange: 'text-badge-orange hover:bg-badge-orange-soft',
  red: 'text-badge-red hover:bg-badge-red-soft',
};

/** The colour of a row action, from what it is called (the same words as its icon). */
export function rowActionColor(id: string, label: string): RowActionColor {
  return COLORS.get(matchIcon(id, label)) ?? 'violet';
}
