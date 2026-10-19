import { describe, expect, it } from 'vitest';

import { loginRouteWithNext, safeNextPath } from '@/constants/routes';

import { formatWait, initialsOf } from './format';
import { evaluatePassword } from './password';
import { parseUserAgent } from './userAgent';

describe('safeNextPath', () => {
  it('accepts same-origin paths only', () => {
    expect(safeNextPath('/account/security?tab=1')).toBe('/account/security?tab=1');
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });

  it('builds the login route with an encoded next parameter', () => {
    expect(loginRouteWithNext('/app/projects?x=1')).toBe('/login?next=%2Fapp%2Fprojects%3Fx%3D1');
    expect(loginRouteWithNext('/')).toBe('/login');
  });
});

describe('evaluatePassword', () => {
  it('scores by length first, then variety', () => {
    expect(evaluatePassword('')).toMatchObject({ score: 0, label: '' });
    expect(evaluatePassword('Ab1!')).toMatchObject({ score: 1, label: 'Too short' });
    expect(evaluatePassword('aaaaaaaaaa')).toMatchObject({ score: 1, label: 'Weak' });
    expect(evaluatePassword('Analytical-Engine-1843')).toMatchObject({ score: 4, label: 'Strong' });
  });
});

describe('format helpers', () => {
  it('formats waits and initials', () => {
    expect(formatWait(1)).toBe('1 second');
    expect(formatWait(42)).toBe('42 seconds');
    expect(formatWait(61)).toBe('2 minutes');
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('  ada ')).toBe('A');
    expect(initialsOf('')).toBe('?');
  });
});

describe('parseUserAgent', () => {
  it('labels common browsers and systems', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
      ),
    ).toEqual({ browser: 'Chrome', os: 'Linux', isMobile: false });
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ browser: 'Safari', os: 'iOS', isMobile: true });
    expect(parseUserAgent(null)).toEqual({
      browser: 'Unknown browser',
      os: 'Unknown device',
      isMobile: false,
    });
  });
});
