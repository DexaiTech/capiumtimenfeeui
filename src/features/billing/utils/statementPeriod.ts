/** First day of the month three months before `today`: the period a statement covers by default. */
export function defaultStatementFrom(today: string): string {
  const [year, month] = today.split('-').map(Number);
  const index = (year ?? 0) * 12 + ((month ?? 1) - 1) - 3;
  const yearOf = Math.floor(index / 12);
  const monthOf = (index % 12) + 1;
  return `${String(yearOf)}-${String(monthOf).padStart(2, '0')}-01`;
}
