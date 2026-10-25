const VERBS: Readonly<Record<string, string>> = {
  read: 'View',
  read_all: 'View everyone’s',
  create: 'Add',
  update: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  manage: 'Manage',
  log: 'Record',
  issue: 'Issue',
  record: 'Record',
  invite: 'Invite',
  reopen: 'Reopen',
};

/** A permission code in words: `timesheet.approve` is "Approve timesheet". */
export function describePermission(code: string): string {
  const [object = code, action = ''] = code.split('.');
  const noun = object.replace(/_/g, ' ');
  const verb = VERBS[action];
  return verb ? `${verb} ${noun}` : `${noun}: ${action.replace(/_/g, ' ')}`;
}
