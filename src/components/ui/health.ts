/** Green at 60 and above, amber from 40, red below (the Capium design). */
export function healthTone(score: number): 'good' | 'fair' | 'poor' {
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}
