export interface ParsedUserAgent {
  browser: string;
  os: string;
  isMobile: boolean;
}

const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: ReadonlyArray<[RegExp, string]> = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

/** A deliberately small user-agent reader for the sessions list; it only labels, never decides. */
export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = userAgent ?? '';
  const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? 'Unknown browser';
  const os = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? 'Unknown device';
  return { browser, os, isMobile: /Mobi|Android|iPhone|iPad|iPod/.test(ua) };
}
