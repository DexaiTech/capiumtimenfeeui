/** The count as the bell's badge shows it: nothing above 99 is counted exactly. */
export function badgeCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/** The accessible name of the bell: it says how many notifications are waiting. */
export function bellLabel(unreadCount: number): string {
  return unreadCount > 0 ? `Notifications, ${badgeCount(unreadCount)} unread` : 'Notifications';
}
